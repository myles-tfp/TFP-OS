import { createClient } from "@/lib/supabase/server";

/** GIF search proxy — keeps the GIPHY key server-side. */
export async function GET(request: Request) {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GIFs aren't configured yet." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 60);

  const endpoint = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=pg-13`;

  const resp = await fetch(endpoint, { next: { revalidate: 60 } });
  if (!resp.ok) {
    return Response.json({ error: "GIPHY didn't answer — try again." }, { status: 502 });
  }

  const data = await resp.json();
  type GiphyImage = { url: string };
  type GiphyGif = {
    id: string;
    images: { fixed_width_small: GiphyImage; fixed_height: GiphyImage };
  };
  const gifs = ((data.data ?? []) as GiphyGif[]).map((g) => ({
    id: g.id,
    preview: g.images.fixed_width_small.url,
    full: g.images.fixed_height.url,
  }));

  return Response.json({ gifs });
}

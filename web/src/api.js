const BASE = "/api";

async function _json(res) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// kind: "labels" | "producers" | "masters"

export function fetchGroups(kind, q = "") {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  return fetch(`${BASE}/groups/${kind}?${qs}`).then(_json);
}

export function fetchGroup(kind, slug) {
  return fetch(`${BASE}/groups/${kind}/${encodeURIComponent(slug)}`).then(_json);
}

export function fetchGroupArtists(kind, slug) {
  return fetch(`${BASE}/groups/${kind}/${encodeURIComponent(slug)}/artists`).then(_json);
}

export function fetchGroupArtistAlbums(kind, slug, artistId) {
  return fetch(`${BASE}/groups/${kind}/${encodeURIComponent(slug)}/artists/${artistId}/albums`).then(_json);
}

export function fetchArtists(q = "") {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  return fetch(`${BASE}/artists?${qs}`).then(_json);
}

export function fetchArtist(id) {
  return fetch(`${BASE}/artists/${id}`).then(_json);
}

export function fetchArtistAlbums(id) {
  return fetch(`${BASE}/artists/${id}/albums`).then(_json);
}

export function fetchAlbum(id) {
  return fetch(`${BASE}/albums/${id}`).then(_json);
}

export function imageUrl(kind, id) {
  if (kind === "artist" || kind === "album") return `${BASE}/images/${kind}/${id}`;
  return `${BASE}/images/group/${kind}/${encodeURIComponent(id)}`;
}

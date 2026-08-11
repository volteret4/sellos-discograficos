const BASE = "/api";

async function _json(res) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function fetchLabels(q = "") {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  return fetch(`${BASE}/labels?${qs}`).then(_json);
}

export function fetchLabel(id) {
  return fetch(`${BASE}/labels/${id}`).then(_json);
}

export function fetchLabelArtists(id) {
  return fetch(`${BASE}/labels/${id}/artists`).then(_json);
}

export function fetchLabelArtistAlbums(labelId, artistId) {
  return fetch(`${BASE}/labels/${labelId}/artists/${artistId}/albums`).then(_json);
}

export function fetchProducers(q = "") {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  return fetch(`${BASE}/producers?${qs}`).then(_json);
}

export function fetchProducer(slug) {
  return fetch(`${BASE}/producers/${encodeURIComponent(slug)}`).then(_json);
}

export function fetchProducerArtists(slug) {
  return fetch(`${BASE}/producers/${encodeURIComponent(slug)}/artists`).then(_json);
}

export function fetchProducerArtistAlbums(slug, artistId) {
  return fetch(`${BASE}/producers/${encodeURIComponent(slug)}/artists/${artistId}/albums`).then(_json);
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
  return `${BASE}/images/${kind}/${id}`;
}

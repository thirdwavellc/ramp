export function createSourceTags(sources) {
  const sourceTags = [];
  for (let i = 0, total = sources.length; i < total; i++) {
    const source = sources[i];
    sourceTags.push(
      `<source src="${source.src}" type="${source.format}" data-quality="${source.quality}" />`
    );
  }
  return sourceTags;
}

export function createTrackTags(tracks) {
  const tracksTags = [];
  for (let i = 0, total = tracks.length; i < total; i++) {
    const track = tracks[i];
    tracksTags.push(
      `<track srclang="en" kind="subtitles" type="${track.format}" src="${track.id}"></track>`
    );
  }
  return tracksTags;
}

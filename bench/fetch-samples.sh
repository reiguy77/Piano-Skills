#!/bin/sh
# Downloads the Salamander Grand Piano samples (CC-BY 3.0, Alexander Holm) used by the
# recognition benchmark and converts them to raw 48 kHz mono 16-bit PCM. Needs curl and ffmpeg.
set -e
cd "$(dirname "$0")"
mkdir -p samples
for octave in 1 2 3 4 5 6 7; do
  for name in C Ds Fs A; do
    out="samples/$name$octave.raw"
    [ -f "$out" ] && continue
    curl -sfL "https://tonejs.github.io/audio/salamander/$name$octave.mp3" -o "samples/tmp.mp3"
    ffmpeg -loglevel error -y -i samples/tmp.mp3 -ac 1 -ar 48000 -f s16le "$out"
  done
done
rm -f samples/tmp.mp3
ls samples | wc -l

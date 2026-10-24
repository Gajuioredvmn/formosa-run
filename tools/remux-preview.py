"""Make a browser MediaRecorder MP4 seekable without re-encoding or retiming.

Usage: python tools/remux-preview.py source.mp4 final.mp4
Requires PyAV. Refuses to replace an existing destination.
"""
import argparse
import json
from pathlib import Path

import av

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("destination", type=Path)
args = parser.parse_args()
if args.destination.exists():
    parser.error("Destination already exists; choose a new filename.")
with av.open(str(args.source)) as incoming, av.open(
    str(args.destination), "w", format="mp4", options={"movflags": "faststart"}
) as outgoing:
    stream = incoming.streams.video[0]
    target = outgoing.add_stream_from_template(stream)
    for packet in incoming.demux(stream):
        if packet.dts is None:
            continue
        packet.stream = target
        outgoing.mux(packet)
with av.open(str(args.destination)) as movie:
    print(json.dumps({
        "file": str(args.destination),
        "durationSeconds": movie.duration / 1_000_000,
        "width": movie.streams.video[0].width,
        "height": movie.streams.video[0].height,
        "remuxOnly": True,
    }))

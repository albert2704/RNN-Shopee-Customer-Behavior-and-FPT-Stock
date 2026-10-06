# Sequence walkthrough source

A 40-second, silent video with English captions around real screenshots of the Vietnamese website. Captures were made on 10 October 2026; values shown are historical snapshots, not a live quote. The underlying application was not recreated or altered for the video.

## Re-render

Requires Node.js 22+, FFmpeg and a Chromium browser (HyperFrames can manage its renderer).

```bash
cd docs/video
npm run check
npm run dev
npm run render -- --quality delivery --crf 20 --output ../media/sequence-walkthrough.mp4
```

`package.json` pins HyperFrames 0.8.144. `index.html` owns the timeline and `compositions/frames/` owns the scenes and captions; `BRIEF.md` and `STORYBOARD.md` record the structure. Shipped local screenshots, fonts and GSAP make composition assets self-contained.

Assets: screenshots from the Sequence project; Be Vietnam Pro fonts from the website's existing assets; GSAP 3.14.2 standard distribution (license header retained). The line entrance adapts HyperFrames `line-by-line-slide`; the subtle moving spotlight adapts `yt-feather-highlight`. Screenshots stay fixed: a moving red outline and soft spotlight guide attention without zoom or camera animation. There is no narration, music or generated voice.

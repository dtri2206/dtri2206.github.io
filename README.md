# Tri Nguyen: personal homepage

Static site (HTML, CSS, vanilla JS, no build step) for the ESC Group page at UB. It plays like a short
film while you scroll: one carbon atom, drawn on a fixed canvas behind the page, travels through five scenes.

1. **About:** headshot as the nucleus, 6 electrons on two tilted orbits.
2. **Research:** the orbits turn face-on and become SATE's five layers; the headshot becomes the recorder.
   Ring 1 closes (today), ring 2 reaches about half (next).
3. **News:** two electrons land as the two dates.
4. **Before UB:** one electron pulls a thread down the section; each heading lights up when it is passed.
   The video opens out of a small circle; photos rise one after another.
5. **Contact:** the atom forms again, small, beside the email.

## How it works
- `script.js`: `compose()` reads the scroll position and the placeholder slots (`#slot-atom`, `#slot-layers`,
  `[data-dot]`, `#rail`, `#slot-mini`) and returns the film state; `draw()` paints it; `stage()` moves the text
  and media. Everything is a function of scroll, so it plays backwards and survives jumps. Only the
  electrons' spin uses time.
- Laptops get smooth wheel scrolling (Lenis 1.1.13 from unpkg); phones keep native scroll.
- Reduced motion: no spin, no smooth scroll; the scenes still follow the scroll.

## Edit
- Text: `index.html`. Colors and type: tokens at the top of `styles.css`.
- Headshot: put it at `assets/img/headshot.jpg` (square works best). Until then the nucleus shows "TN".
- Run locally: `python3 -m http.server 8000`, then open http://localhost:8000.

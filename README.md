# Minigun vs Zombies — simple browser game

This repository contains a simple platformer browser game built with HTML, CSS and JavaScript. You run, jump between platforms and spray zombies with a minigun.

Features
- Platformer physics (jumping, gravity, platforms)
- Rapid-fire minigun (hold mouse to fire)
- Zombies spawn and move toward you
- Score, health, restart overlay
- Responsive canvas that scales to container

How to run locally
1. Open `docs/index.html` in a modern browser (Chrome, Edge, Firefox).
2. Or host with a static server (e.g. `python -m http.server` from the repo root and open the `docs` folder).

Deploy to GitHub Pages
1. Ensure the files are in the `docs/` folder on your `main` branch.
2. In your repository on GitHub go to Settings → Pages.
3. Set "Source" to `main` branch and `/docs` folder, save.
4. Your site will be available at `https://<your-username>.github.io/<repo-name>/` (may take a minute).

Controls
- Move: A / D or Left / Right arrow
- Jump: W / Up arrow / Space
- Aim: Move the mouse
- Fire: Hold left mouse button (or tap & hold on mobile)

Customize
- Edit `docs/main.js` to tweak spawn rate, player speed, bullet damage, visuals, etc.
- Swap rectangles for sprites if you'd like to add art assets.

License
MIT

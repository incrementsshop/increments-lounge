# Regenerating the renders in docs/shots

1. `python3 tools/serve.py`
2. Open `http://localhost:8420/?capture&quality=high` (the `capture` flag keeps the WebGL buffer readable).
3. Step inside, then run this in the browser console:

```js
const app = window.__lounge;
for (const [i, s] of app.stations.entries()) {
  app.rig.jump(i);
  await new Promise(r => setTimeout(r, 1500)); // let the frame settle
  const blob = await new Promise(r => app.world.renderer.domElement.toBlob(r, 'image/jpeg', 0.86));
  await fetch(`/__capture?name=desktop-${String(i + 1).padStart(2, '0')}-${s.id}`, { method: 'POST', body: blob });
}
```

For phone framings, switch the browser's device emulation to a phone first and use the `mobile-` prefix. `POST /__capture` only exists on the local dev server.

// The live demo: plays an exported character (avatar-tools web-demo) the way the app does. It walks on,
// asks, waits for an answer, reacts and leaves, then comes back a little later.
(() => {
  const base = "character/";
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("character");
  const bubble = document.getElementById("bubble");
  const confirmation = document.getElementById("confirmation");
  const hint = document.getElementById("hint");
  const context = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let data;
  const sheets = {};
  let x = 0;
  let facesLeft = false;
  let current = null; // { clip, frame, loop }
  let answer = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frameTime = () => 1000 / data.fps;

  function resize() {
    const scale = window.devicePixelRatio || 1;
    canvas.width = stage.clientWidth * scale;
    canvas.height = data.height * scale;
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function draw() {
    context.clearRect(0, 0, stage.clientWidth, data.height);
    if (!current) return;
    const sheet = sheets[current.clip];
    const pixelWidth = sheet.naturalWidth / data.clips[current.clip].frames;
    context.save();
    if (facesLeft) {
      context.translate(x + data.width, 0);
      context.scale(-1, 1);
    } else {
      context.translate(x, 0);
    }
    context.drawImage(sheet, current.frame * pixelWidth, 0, pixelWidth, sheet.naturalHeight, 0, 0, data.width, data.height);
    context.restore();
  }

  /// Plays one segment. Moving ones go at their speed until `until(x)` is true.
  async function play(segment, until) {
    const frames = data.clips[segment.clip].frames;
    const speed = (segment.speed || 0) * (facesLeft ? -1 : 1);
    current = { clip: segment.clip, frame: 0 };
    let last = performance.now();
    for (let index = 0; ; index += 1) {
      current.frame = index % frames;
      draw();
      await sleep(frameTime());
      const now = performance.now();
      x += speed * ((now - last) / 1000);
      last = now;
      if (segment.repeat === "once" && index >= frames - 1) return;
      if (segment.repeat === "untilAnswered" && answer && current.frame === frames - 1) return;
      if ((segment.repeat === "untilArrived" || segment.repeat === "untilOffscreen") && until(x)) return;
    }
  }

  async function playState(name, until) {
    const state = data.states[name];
    facesLeft = state.direction === "left";
    for (const segment of state.segments) {
      await play(segment, until);
    }
  }

  /// Over the character's bubble point, as the app places it.
  function placeAbove(element) {
    const floor = parseFloat(getComputedStyle(canvas).bottom) || 0;
    element.style.left = `${x + data.width * data.bubbleAnchor.x}px`;
    element.style.bottom = `${floor + data.height * data.bubbleAnchor.y + 8}px`;
  }

  async function round() {
    const target = (stage.clientWidth - data.width) / 2;
    x = reduceMotion ? target : -data.width;
    answer = null;
    if (!reduceMotion) {
      await playState("enter", (position) => position >= target);
      x = target;
    }
    placeAbove(bubble);
    bubble.hidden = false;
    hint.textContent = "Try it: answer Droplet.";
    const asking = playState("ask");
    answer = await new Promise((resolve) => {
      document.getElementById("yes").onclick = () => resolve("yes");
      document.getElementById("later").onclick = () => resolve("later");
    });
    bubble.hidden = true;
    if (answer === "yes") {
      confirmation.textContent = "Nice! 💙";
      placeAbove(confirmation);
      confirmation.hidden = false;
    }
    // Like the app, the reaction starts when the current loop of the ask ends.
    await asking;
    if (answer === "yes") {
      await playState("yes");
      confirmation.hidden = true;
      if (!reduceMotion) await playState("exitHappy", (position) => position > stage.clientWidth);
      hint.textContent = "It celebrates and runs off. It'll be back.";
    } else {
      await playState("later");
      if (!reduceMotion) await playState("exitSad", (position) => position < -data.width);
      hint.textContent = "It walks off sadly, and asks again a little later.";
    }
    current = null;
    draw();
    await sleep(2500);
  }

  async function start() {
    data = await (await fetch(`${base}character.json`)).json();
    await Promise.all(Object.entries(data.clips).map(([clip, info]) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = reject;
      image.src = base + info.file;
      sheets[clip] = image;
    })));
    resize();
    window.addEventListener("resize", () => { resize(); draw(); });
    for (;;) await round();
  }

  start().catch(() => { hint.textContent = ""; stage.hidden = true; });

  // The latest version, for the download line.
  fetch("https://api.github.com/repos/gollasandeepkumar/AvatarReminder-releases/releases/latest")
    .then((response) => (response.ok ? response.json() : null))
    .then((release) => { if (release && release.tag_name) document.getElementById("version").textContent = `Version ${release.tag_name.replace(/^v/, "")}`; })
    .catch(() => {});
})();

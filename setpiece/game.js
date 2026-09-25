(function () {
  "use strict";

  const canvas = document.getElementById("stadiumCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const motionAtlas = new Image();
  motionAtlas.src = "./assets/kick-atlas-v2.webp";
  const stadiumMobile = new Image();
  stadiumMobile.src = "./assets/stadium-mobile.webp";
  const stadiumDesktop = new Image();
  stadiumDesktop.src = "./assets/stadium-desktop.webp";

  const players = [
    { name: "Deem", fullName: "Kadeem", role: "Rapper", position: "Midfielder", height: "", weight: "", goals: 0, kicks: 0, supers: 2, blocked: 0 },
    { name: "Chan", fullName: "Chan", role: "Producer", position: "Defender", height: "", weight: "", goals: 0, kicks: 0, supers: 2, blocked: 0 }
  ];

  const elements = {
    deemCard: document.getElementById("deemCard"),
    chanCard: document.getElementById("chanCard"),
    deemGoals: document.getElementById("deemGoals"),
    chanGoals: document.getElementById("chanGoals"),
    deemKicks: document.getElementById("deemKicks"),
    chanKicks: document.getElementById("chanKicks"),
    deemSupers: document.getElementById("deemSupers"),
    chanSupers: document.getElementById("chanSupers"),
    deemScore: document.getElementById("deemScore"),
    chanScore: document.getElementById("chanScore"),
    roundLabel: document.getElementById("roundLabel"),
    scoreRound: document.getElementById("scoreRound"),
    statusTitle: document.getElementById("statusTitle"),
    statusHelp: document.getElementById("statusHelp"),
    aimReadout: document.getElementById("aimReadout"),
    startButton: document.getElementById("startButton"),
    shotButtons: document.getElementById("shotButtons"),
    superShot: document.getElementById("superShot"),
    standardShot: document.getElementById("standardShot"),
    activeSuperCount: document.getElementById("activeSuperCount"),
    rematchButton: document.getElementById("rematchButton"),
    aimStick: document.getElementById("aimStick"),
    stickBase: document.getElementById("stickBase"),
    stickKnob: document.getElementById("stickKnob")
  };

  const palette = {
    sky: "#09191f",
    dark: "#07100e",
    pitch: "#17452e",
    pitchLight: "#205637",
    pitchDark: "#123923",
    line: "#8cb37b",
    acid: "#d5ff62",
    orange: "#ffb04c",
    white: "#f5f6e8"
  };

  let phase = "intro";
  let activeIndex = 0;
  let attempts = 0;
  let aim = { x: 0.5, y: 0.48 };
  let currentShot = null;
  let shotActionResolver = null;
  let cssWidth = 0;
  let cssHeight = 0;
  let pixelRatio = 1;
  let stickInput = { active: false, x: 0, y: 0, pointerId: null };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getGoal(width, height) {
    const layout = getSceneLayout(width, height);
    const portrait = layout.image === stadiumMobile;
    const box = portrait
      ? { left: 0.135, top: 0.268, width: 0.735, height: 0.151 }
      : { left: 0.254, top: 0.284, width: 0.492, height: 0.225 };
    const left = layout.x + box.left * layout.image.naturalWidth * layout.scale;
    const top = layout.y + box.top * layout.image.naturalHeight * layout.scale;
    const goalWidth = box.width * layout.image.naturalWidth * layout.scale;
    const goalHeight = box.height * layout.image.naturalHeight * layout.scale;
    return {
      left: left,
      top: top,
      width: goalWidth,
      height: goalHeight,
      right: left + goalWidth,
      bottom: top + goalHeight
    };
  }

  function getSceneLayout(width, height) {
    const image = width / Math.max(height, 1) > 1.04 ? stadiumDesktop : stadiumMobile;
    const imageWidth = image.naturalWidth || (image === stadiumDesktop ? 1536 : 1024);
    const imageHeight = image.naturalHeight || (image === stadiumDesktop ? 1024 : 1536);
    const scale = Math.max(width / imageWidth, height / imageHeight);
    return {
      image: image,
      scale: scale,
      x: (width - imageWidth * scale) / 2,
      y: 0
    };
  }

  function getKickOrigin(width, height) {
    const layout = getSceneLayout(width, height);
    const portrait = layout.image === stadiumMobile;
    return {
      x: width * 0.5,
      y: layout.y + (portrait ? 0.812 : 0.76) * layout.image.naturalHeight * layout.scale
    };
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    cssWidth = bounds.width;
    cssHeight = bounds.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    draw(cssWidth, cssHeight, performance.now());
  }

  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(width), Math.ceil(height));
  }

  function drawKeeper(cx, top, height, angle, stretch, frameIndex) {
    if (motionAtlas.complete && motionAtlas.naturalWidth > 0) {
      const cellWidth = motionAtlas.naturalWidth / 5;
      const cellHeight = motionAtlas.naturalHeight / 4;
      const drawWidth = height * cellWidth / cellHeight;
      ctx.save();
      ctx.translate(cx, top + height * 0.52);
      ctx.rotate(angle || 0);
      ctx.scale(stretch || 1, 1 / Math.sqrt(stretch || 1));
      ctx.drawImage(motionAtlas, (frameIndex || 0) * cellWidth, 3 * cellHeight, cellWidth, cellHeight, -drawWidth / 2, -height * 0.55, drawWidth, height);
      ctx.restore();
      return;
    }
    const unit = height / 14;
    ctx.save();
    ctx.translate(cx, top + height * 0.52);
    ctx.rotate(angle || 0);
    ctx.scale(stretch || 1, 1 / Math.sqrt(stretch || 1));
    const u = unit;
    rect(-2.1 * u, -7 * u, 4.2 * u, 2.2 * u, "#9a6847");
    rect(-2.5 * u, -7.4 * u, 5 * u, 1.2 * u, "#17201d");
    rect(-3.2 * u, -5 * u, 6.4 * u, 4.7 * u, "#d48c3f");
    rect(-4.7 * u, -4.3 * u, 1.7 * u, 4.3 * u, "#bd7c38");
    rect(3 * u, -4.3 * u, 1.7 * u, 4.3 * u, "#bd7c38");
    rect(-5.2 * u, -0.3 * u, 2 * u, 1.5 * u, "#f2dfae");
    rect(3.4 * u, -0.3 * u, 2 * u, 1.5 * u, "#f2dfae");
    rect(-2.7 * u, -0.3 * u, 5.4 * u, 2.4 * u, "#28332d");
    rect(-2.1 * u, 2.1 * u, 1.6 * u, 4 * u, "#28332d");
    rect(0.5 * u, 2.1 * u, 1.6 * u, 4 * u, "#28332d");
    rect(-2.5 * u, 5.5 * u, 2.2 * u, 1.1 * u, "#d8d6bd");
    rect(0.4 * u, 5.5 * u, 2.2 * u, 1.1 * u, "#d8d6bd");
    rect(-2.7 * u, -3.6 * u, 5.4 * u, 0.9 * u, "#f1bd58");
    ctx.restore();
  }

  function drawGoal(width, height, now) {
    const goal = getGoal(width, height);
    const targetX = goal.left + (currentShot ? currentShot.aim.x : aim.x) * goal.width;
    const targetY = goal.top + (currentShot ? currentShot.aim.y : aim.y) * goal.height;

    let netAge = -1;
    if (currentShot && !currentShot.saved && phase !== "ready" && phase !== "intro") {
      netAge = Math.max(0, (now - (currentShot.started + currentShot.duration * 0.9)) / 1000);
    }
    function netPoint(x, y) {
      if (netAge < 0 || netAge > 0.75) return [x, y];
      const dx = (x - targetX) / Math.max(goal.width, 1);
      const dy = (y - targetY) / Math.max(goal.height, 1);
      const distance = Math.hypot(dx, dy);
      const impulse = Math.exp(-distance * 5.2) * Math.exp(-netAge * 4.1) * goal.height * 0.17;
      const wave = Math.sin(netAge * 38 - distance * 15) * Math.exp(-netAge * 5.2) * Math.max(0, 1 - distance * 1.2) * goal.height * 0.2;
      return [
        x + (distance ? dx / distance : 0) * wave,
        y + (distance ? dy / distance : 0) * wave - impulse
      ];
    }

    ctx.save();
    ctx.strokeStyle = "rgba(249,255,233,.48)";
    ctx.lineWidth = Math.max(0.8, width / 1000);
    const verticals = 13;
    const horizontals = 7;
    for (let i = 0; i <= verticals; i += 1) {
      const x = goal.left + goal.width * i / verticals;
      ctx.beginPath();
      for (let segment = 0; segment <= 8; segment += 1) {
        const y = goal.top + goal.height * segment / 8;
        const point = netPoint(x, y);
        if (segment === 0) ctx.moveTo(point[0], point[1]);
        else ctx.lineTo(point[0], point[1]);
      }
      ctx.stroke();
    }
    for (let i = 0; i <= horizontals; i += 1) {
      const y = goal.top + goal.height * i / horizontals;
      ctx.beginPath();
      for (let segment = 0; segment <= 12; segment += 1) {
        const x = goal.left + goal.width * segment / 12;
        const point = netPoint(x, y);
        if (segment === 0) ctx.moveTo(point[0], point[1]);
        else ctx.lineTo(point[0], point[1]);
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,231,.95)";
    ctx.lineWidth = Math.max(2, width / 260);
    ctx.shadowColor = "rgba(255,243,179,.7)";
    ctx.shadowBlur = Math.max(3, width / 130);
    ctx.strokeRect(goal.left, goal.top, goal.width, goal.height);
    ctx.restore();

    let keeperX = width * 0.5;
    let keeperY = goal.top + goal.height * 0.17;
    let keeperAngle = 0;
    let keeperStretch = 1;
    let keeperFrame = 0;
    if (currentShot && phase !== "ready" && phase !== "intro") {
      const progress = clamp((now - currentShot.started) / currentShot.duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      keeperX += (currentShot.keeper.x - keeperX) * eased;
      keeperY += (currentShot.keeper.y - keeperY) * eased;
      const divesLeft = currentShot.keeper.x < width * 0.5;
      keeperAngle = (divesLeft ? -1 : 1) * 0.42 * eased;
      keeperStretch = 1 + 0.08 * eased;
      if (phase === "result" || phase === "matchover") {
        keeperX = currentShot.keeper.x;
        keeperY = currentShot.keeper.y;
        keeperAngle = (divesLeft ? -1 : 1) * 0.42;
        if (currentShot.saved) keeperFrame = divesLeft ? 2 : 3;
        else keeperFrame = 4;
      } else if (progress < 0.22) {
        keeperFrame = 1;
      } else {
        keeperFrame = divesLeft ? 2 : 3;
      }
    }
    drawKeeper(keeperX, keeperY, goal.height * 0.72, keeperAngle, keeperStretch, keeperFrame);

    const tx = goal.left + aim.x * goal.width;
    const ty = goal.top + aim.y * goal.height;
    const pulse = 0.88 + Math.sin(now / 150) * 0.12;
    let ringColor = palette.acid;
    if (phase === "result" && currentShot) ringColor = currentShot.saved ? "#ff7164" : "#ddff73";
    if (phase === "shooting") ringColor = currentShot && currentShot.kind === "super" ? "#ffbd5f" : "#fffbe8";
    ctx.save();
    ctx.globalAlpha = phase === "shooting" ? 0.58 : 0.94;
    ctx.strokeStyle = ringColor;
    ctx.fillStyle = ringColor;
    ctx.lineWidth = Math.max(2, width / 220);
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(7, width * 0.018) * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(2, width * 0.005), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx - width * 0.032, ty);
    ctx.lineTo(tx - width * 0.012, ty);
    ctx.moveTo(tx + width * 0.012, ty);
    ctx.lineTo(tx + width * 0.032, ty);
    ctx.moveTo(tx, ty - width * 0.032);
    ctx.lineTo(tx, ty - width * 0.012);
    ctx.moveTo(tx, ty + width * 0.012);
    ctx.lineTo(tx, ty + width * 0.032);
    ctx.stroke();
    ctx.restore();
    return goal;
  }

  function drawPlayer(width, height, now) {
    const useAtlas = motionAtlas.complete && motionAtlas.naturalWidth > 0;
    const playerHeight = Math.min(height * 0.36, width * 0.88);
    const cellWidth = useAtlas ? motionAtlas.naturalWidth / 5 : 768;
    const cellHeight = useAtlas ? motionAtlas.naturalHeight * 0.375 : 1024;
    const drawWidth = playerHeight * cellWidth / cellHeight;
    let motionFrame = 0;
    let kickShift = 0;
    let lean = 0;
    if (phase === "shooting" && currentShot) {
      const progress = clamp((now - currentShot.started) / currentShot.duration, 0, 1);
      kickShift = -Math.sin(progress * Math.PI) * height * 0.018;
      lean = Math.sin(progress * Math.PI) * 0.025;
      motionFrame = progress < 0.12 ? 0 : progress < 0.31 ? 1 : progress < 0.49 ? 2 : progress < 0.61 ? 3 : 4;
    } else if (phase === "result" && currentShot) {
      kickShift = -height * 0.012;
      motionFrame = 4;
    }

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    const spot = getKickOrigin(width, height);
    ctx.ellipse(width * 0.5, spot.y + height * 0.008, Math.max(20, width * 0.13), Math.max(5, height * 0.012), 0, 0, Math.PI * 2);
    ctx.fill();
    const x = width * 0.5;
    const y = spot.y + height * 0.012 - playerHeight + kickShift;
    ctx.translate(x, y + playerHeight);
    ctx.rotate(lean);
    ctx.imageSmoothingEnabled = false;
    if (useAtlas) {
      ctx.drawImage(motionAtlas, motionFrame * cellWidth, activeIndex * cellHeight, cellWidth, cellHeight, -drawWidth / 2, -playerHeight, drawWidth, playerHeight);
    } else {
      drawFallbackPlayer(-drawWidth / 2, -playerHeight, drawWidth, playerHeight, activeIndex);
    }
    ctx.restore();
  }

  function drawFallbackPlayer(x, y, width, height, playerIndex) {
    const s = width / 18;
    const shirt = playerIndex === 0 ? "#161a1d" : "#5237a1";
    const pants = playerIndex === 0 ? "#111416" : "#80624d";
    rect(x + 6 * s, y + 1 * s, 6 * s, 2.8 * s, "#101719");
    rect(x + 5 * s, y + 4 * s, 8 * s, 6 * s, shirt);
    rect(x + 3 * s, y + 4.7 * s, 2.4 * s, 5 * s, shirt);
    rect(x + 12.5 * s, y + 4.7 * s, 2.4 * s, 5 * s, shirt);
    rect(x + 6 * s, y + 10 * s, 2.7 * s, 6 * s, pants);
    rect(x + 9.3 * s, y + 10 * s, 2.7 * s, 6 * s, pants);
    rect(x + 5.5 * s, y + 16 * s, 4 * s, 1.5 * s, "#d8d8cb");
    rect(x + 9.1 * s, y + 16 * s, 4 * s, 1.5 * s, "#d8d8cb");
  }

  function drawBallAt(x, y, radius, color, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation || 0);
    ctx.fillStyle = "rgba(0,0,0,.38)";
    ctx.beginPath();
    ctx.ellipse(0, radius * 1.22, radius * 1.35, radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    const sphere = ctx.createRadialGradient(-radius * 0.36, -radius * 0.42, radius * 0.08, 0, 0, radius * 1.08);
    sphere.addColorStop(0, "#ffffff");
    sphere.addColorStop(0.62, color);
    sphere.addColorStop(1, "#c9d2c1");
    ctx.fillStyle = sphere;
    ctx.strokeStyle = "#17201a";
    ctx.lineWidth = Math.max(1, radius * 0.11);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const pentagon = [];
    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
      pentagon.push([Math.cos(angle) * radius * 0.34, Math.sin(angle) * radius * 0.34]);
    }
    ctx.fillStyle = "#17201a";
    ctx.beginPath();
    pentagon.forEach(function (point, index) {
      if (index === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(23,32,26,.84)";
    ctx.lineWidth = Math.max(0.7, radius * 0.045);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius * 0.34, Math.sin(angle) * radius * 0.34);
      ctx.lineTo(Math.cos(angle + Math.PI / 5) * radius * 0.77, Math.sin(angle + Math.PI / 5) * radius * 0.77);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.beginPath();
    ctx.arc(-radius * 0.37, -radius * 0.43, Math.max(0.8, radius * 0.13), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShotBall(width, height, now, goal) {
    const origin = getKickOrigin(width, height);
    const kickOffX = origin.x + width * 0.10;
    const kickOffY = origin.y - height * 0.003;
    if (phase !== "shooting" && phase !== "result") {
      drawBallAt(kickOffX, kickOffY, Math.max(7, width * 0.024), "#f3f1dd", 0);
      return;
    }
    if (!currentShot) return;
    const shotProgress = phase === "result" ? 1 : clamp((now - currentShot.started) / currentShot.duration, 0, 1);
    const progress = clamp((shotProgress - 0.55) / 0.45, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 2.4);
    const startX = kickOffX;
    const startY = kickOffY;
    const endX = goal.left + currentShot.aim.x * goal.width;
    const endY = goal.top + currentShot.aim.y * goal.height;
    let travel = eased;
    if (currentShot.saved && progress > 0.78) travel = 1 - (progress - 0.78) * 0.45;
    const x = startX + (endX - startX) * travel;
    let y = startY + (endY - startY) * travel - Math.sin(Math.min(travel, 1) * Math.PI) * height * 0.12;
    if (!currentShot.saved && progress > 0.86) y += height * 0.035 * clamp((progress - 0.86) / 0.14, 0, 1);
    if (currentShot.saved && progress > 0.78) y += height * 0.025 * clamp((progress - 0.78) / 0.22, 0, 1);
    const radius = Math.max(5, width * (0.038 - 0.019 * travel));
    if (phase === "shooting" && progress < 0.94 && progress > 0.02) {
      ctx.save();
      ctx.globalAlpha = currentShot.kind === "super" ? 0.62 : 0.35;
      ctx.strokeStyle = currentShot.kind === "super" ? "#ffbd5f" : "#e5f1de";
      ctx.lineWidth = Math.max(2, width * 0.006);
      ctx.beginPath();
      ctx.moveTo(x - width * 0.055, y + height * 0.035);
      ctx.lineTo(x - width * 0.012, y + height * 0.008);
      ctx.stroke();
      ctx.restore();
    }
    drawBallAt(x, y, radius, currentShot.kind === "super" ? "#ffe39c" : "#f3f1dd", eased * 9);
  }

  function draw(width, height, now) {
    if (!width || !height) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#0d2117";
    ctx.fillRect(0, 0, width, height);
    const scene = getSceneLayout(width, height);
    if (scene.image.complete && scene.image.naturalWidth > 0) {
      ctx.drawImage(
        scene.image,
        scene.x,
        scene.y,
        scene.image.naturalWidth * scene.scale,
        scene.image.naturalHeight * scene.scale
      );
    }
    const vignette = ctx.createLinearGradient(0, 0, 0, height);
    vignette.addColorStop(0, "rgba(1,8,11,.16)");
    vignette.addColorStop(0.58, "rgba(2,10,5,0)");
    vignette.addColorStop(1, "rgba(1,8,5,.3)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    const goal = drawGoal(width, height, now);
    drawPlayer(width, height, now);
    drawShotBall(width, height, now, goal);
  }

  function frame(now) {
    if (stickInput.active && phase === "ready") {
      const elapsed = Math.min(0.05, Math.max(0, (now - (frame.lastTime || now)) / 1000));
      aim.x = clamp(aim.x + stickInput.x * elapsed * 0.64, 0.08, 0.92);
      aim.y = clamp(aim.y + stickInput.y * elapsed * 0.64, 0.08, 0.92);
    }
    frame.lastTime = now;
    elements.aimReadout.textContent = "X " + Math.round(aim.x * 100) + "% · Y " + Math.round(aim.y * 100) + "%";
    if (phase === "shooting" && currentShot && now - currentShot.started >= currentShot.duration) {
      resolveShot(now);
    } else if (phase === "result" && currentShot && now - currentShot.resultStarted >= 1050) {
      advanceMatch();
    }
    draw(cssWidth, cssHeight, now);
    window.requestAnimationFrame(frame);
  }

  function updateHud() {
    elements.deemGoals.textContent = String(players[0].goals);
    elements.chanGoals.textContent = String(players[1].goals);
    elements.deemKicks.textContent = String(players[0].kicks);
    elements.chanKicks.textContent = String(players[1].kicks);
    elements.deemSupers.textContent = players[0].supers + "/2";
    elements.chanSupers.textContent = players[1].supers + "/2";
    elements.deemScore.textContent = String(players[0].goals);
    elements.chanScore.textContent = String(players[1].goals);
    elements.deemCard.classList.toggle("is-active", phase !== "matchover" && activeIndex === 0);
    elements.chanCard.classList.toggle("is-active", phase !== "matchover" && activeIndex === 1);
    elements.aimReadout.textContent = "X " + Math.round(aim.x * 100) + "% · Y " + Math.round(aim.y * 100) + "%";
    elements.activeSuperCount.textContent = players[activeIndex].supers + " LEFT";

    const isReady = phase === "ready";
    elements.startButton.hidden = phase !== "intro";
    elements.shotButtons.hidden = phase === "intro" || phase === "matchover";
    elements.rematchButton.hidden = phase !== "matchover";
    elements.superShot.disabled = !isReady || players[activeIndex].supers <= 0;
    elements.standardShot.disabled = !isReady;
    elements.aimStick.disabled = !isReady;
    elements.aimStick.setAttribute("aria-pressed", String(stickInput.active && isReady));

    if (phase === "intro") {
      elements.roundLabel.textContent = "MATCH READY";
      elements.scoreRound.textContent = "FIRST TO 5";
      elements.statusTitle.textContent = "READY AT THE SPOT";
      elements.statusHelp.textContent = "Start the match, hold the 360° stick to steer the live target, then press A or B.";
    } else if (phase === "ready") {
      elements.roundLabel.textContent = players[activeIndex].name.toUpperCase() + " · SHOOTOUT";
      elements.scoreRound.textContent = "FIRST TO 5";
      elements.statusTitle.textContent = players[activeIndex].name.toUpperCase() + " UP";
      elements.statusHelp.textContent = "Hold and steer the stick to move the reticle live. Press B to strike or A for a Super.";
    } else if (phase === "shooting") {
      elements.roundLabel.textContent = "SHOT IN FLIGHT";
      elements.scoreRound.textContent = "FIRST TO 5";
      elements.statusTitle.textContent = currentShot.kind === "super" ? "SUPER STRIKE!" : "SHOT TAKEN";
      elements.statusHelp.textContent = "The keeper is moving.";
    } else if (phase === "result") {
      elements.roundLabel.textContent = currentShot.saved ? "SAVED" : "GOAL";
      elements.scoreRound.textContent = "FIRST TO 5";
      elements.statusTitle.textContent = currentShot.saved ? "SAVED!" : "GOAL!";
      elements.statusHelp.textContent = currentShot.saved
        ? players[currentShot.playerIndex].name + "'s shot was blocked. Next kick is coming up."
        : players[currentShot.playerIndex].name + " finds the net. Next kick is coming up.";
    } else {
      elements.roundLabel.textContent = "FINAL SCORE";
      elements.scoreRound.textContent = "FINAL";
      const result = players[0].goals > players[1].goals ? "DEEM WINS" : "CHAN WINS";
      elements.statusTitle.textContent = result;
      elements.statusHelp.textContent = "Final score " + players[0].goals + "–" + players[1].goals + ". Run it back for another shootout.";
    }
  }

  function setAim(x, y) {
    aim.x = clamp(x, 0.08, 0.92);
    aim.y = clamp(y, 0.08, 0.92);
    updateHud();
    draw(cssWidth, cssHeight, performance.now());
  }

  function moveAim(direction) {
    if (phase !== "ready") return;
    const step = 0.065;
    let x = aim.x;
    let y = aim.y;
    if (direction === "left") x -= step;
    if (direction === "right") x += step;
    if (direction === "up") y -= step;
    if (direction === "down") y += step;
    setAim(x, y);
  }

  function startMatch() {
    if (phase !== "intro") return false;
    phase = "ready";
    aim = { x: 0.5, y: 0.48 };
    updateHud();
    draw(cssWidth, cssHeight, performance.now());
    return true;
  }

  function takeShot(kind) {
    if (phase !== "ready") return Promise.resolve({ ok: false, error: "A kick is not ready." });
    if (kind !== "standard" && kind !== "super") return Promise.resolve({ ok: false, error: "Choose standard or super." });
    if (kind === "super" && players[activeIndex].supers <= 0) return Promise.resolve({ ok: false, error: "No Super Strikes remain for this player." });
    const playerIndex = activeIndex;
    if (kind === "super") players[playerIndex].supers -= 1;
    const goal = getGoal(cssWidth, cssHeight);
    const keeperSaves = Math.random() < 0.3;
    const otherX = aim.x < 0.5 ? 0.76 : 0.24;
    const keeperHeight = goal.height * 0.66;
    const keeperVerticalOffset = keeperHeight * 0.52;
    const keeperAim = keeperSaves
      ? { x: goal.left + aim.x * goal.width, y: goal.top + aim.y * goal.height - keeperVerticalOffset }
      : { x: goal.left + otherX * goal.width, y: goal.top + (0.22 + Math.random() * 0.52) * goal.height - keeperVerticalOffset };
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    currentShot = {
      kind: kind,
      playerIndex: playerIndex,
      aim: { x: aim.x, y: aim.y },
      saved: keeperSaves,
      keeper: keeperAim,
      started: performance.now(),
      duration: reducedMotion ? 360 : kind === "super" ? 820 : 980
    };
    phase = "shooting";
    updateHud();
    return new Promise(function (resolve) {
      shotActionResolver = resolve;
    });
  }

  function resolveShot(now) {
    if (!currentShot || phase !== "shooting") return;
    const player = players[currentShot.playerIndex];
    player.kicks += 1;
    if (currentShot.saved) player.blocked += 1;
    else player.goals += 1;
    attempts += 1;
    currentShot.resultStarted = now;
    phase = "result";
    updateHud();
    if (shotActionResolver) {
      shotActionResolver({
        ok: true,
        outcome: currentShot.saved ? "saved" : "goal",
        player: player.name,
        score: { deem: players[0].goals, chan: players[1].goals },
        attempts: attempts
      });
      shotActionResolver = null;
    }
  }

  function advanceMatch() {
    if (phase !== "result") return;
    if (players[0].goals >= 5 || players[1].goals >= 5) {
      phase = "matchover";
    } else {
      activeIndex = 1 - activeIndex;
      aim = { x: 0.5, y: 0.48 };
      currentShot = null;
      phase = "ready";
    }
    updateHud();
  }

  function resetMatch() {
    players.forEach(function (player) {
      player.goals = 0;
      player.kicks = 0;
      player.supers = 2;
      player.blocked = 0;
    });
    attempts = 0;
    activeIndex = 0;
    aim = { x: 0.5, y: 0.48 };
    currentShot = null;
    shotActionResolver = null;
    phase = "intro";
    updateHud();
    draw(cssWidth, cssHeight, performance.now());
  }

  function getMatchState() {
    return {
      phase: phase,
      activePlayer: phase === "matchover" ? null : players[activeIndex].name,
      attempts: attempts,
      goalTarget: 5,
      aim: { x: Number(aim.x.toFixed(2)), y: Number(aim.y.toFixed(2)) },
      keeperSaveChance: 0.3,
      score: { deem: players[0].goals, chan: players[1].goals },
      players: players.map(function (player) {
        return {
          name: player.name,
          fullName: player.fullName,
          role: player.role,
          position: player.position,
          height: player.height || null,
          weight: player.weight || null,
          goals: player.goals,
          kicks: player.kicks,
          superStrikesLeft: player.supers,
          blocked: player.blocked
        };
      })
    };
  }

  function isObjectInput(input) {
    return Boolean(input && typeof input === "object" && !Array.isArray(input));
  }

  function registerWebMCP() {
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "get_set_piece_match_state",
        title: "Read SET PIECE match",
        description: "Read the visible Deem versus Chan penalty match score, turn, target position, and remaining Super Strikes.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: function (input) {
          if (!isObjectInput(input) || Object.keys(input).length) throw new Error("Expected an empty object.");
          return getMatchState();
        }
      },
      {
        name: "move_set_piece_aim",
        title: "Move shot target",
        description: "Move the visible target to normalized x and y coordinates from 0 to 1 inside the goal before the active player shoots.",
        inputSchema: {
          type: "object",
          properties: { x: { type: "number", minimum: 0, maximum: 1 }, y: { type: "number", minimum: 0, maximum: 1 } },
          required: ["x", "y"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: function (input) {
          if (!isObjectInput(input) || !Number.isFinite(input.x) || !Number.isFinite(input.y) || input.x < 0 || input.x > 1 || input.y < 0 || input.y > 1) {
            throw new Error("Provide x and y numbers from 0 to 1.");
          }
          if (phase !== "ready") throw new Error("Start the match and wait for a ready kick before aiming.");
          setAim(input.x, input.y);
          return getMatchState();
        }
      },
      {
        name: "start_set_piece_match",
        title: "Start SET PIECE match",
        description: "Start the visible first-to-five penalty match if it has not started.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: function (input) {
          if (!isObjectInput(input) || Object.keys(input).length) throw new Error("Expected an empty object.");
          if (!startMatch()) throw new Error("The match has already started.");
          return getMatchState();
        }
      },
      {
        name: "take_set_piece_shot",
        title: "Take a SET PIECE shot",
        description: "Take the active player's standard or Super Strike using the currently visible target. A Super Strike consumes one of that player's two uses.",
        inputSchema: {
          type: "object",
          properties: { type: { type: "string", enum: ["standard", "super"] } },
          required: ["type"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async function (input) {
          if (!isObjectInput(input) || (input.type !== "standard" && input.type !== "super")) throw new Error("Choose standard or super.");
          const result = await takeShot(input.type);
          if (!result.ok) throw new Error(result.error);
          return { ok: true, outcome: result.outcome, player: result.player, score: result.score, attempts: result.attempts, state: getMatchState() };
        }
      }
    ];
    tools.forEach(function (tool) {
      try {
        Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(function () {});
      } catch (_) {}
    });
    window.addEventListener("pagehide", function () { lifecycle.abort(); }, { once: true });
  }

  function updateStickFromPointer(event) {
    if (!stickInput.active || event.pointerId !== stickInput.pointerId || phase !== "ready") return;
    const bounds = elements.stickBase.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const travel = Math.min(bounds.width, bounds.height) * 0.34;
    let x = (event.clientX - centerX) / travel;
    let y = (event.clientY - centerY) / travel;
    const magnitude = Math.hypot(x, y);
    if (magnitude < 0.12) { x = 0; y = 0; }
    else if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    stickInput.x = x;
    stickInput.y = y;
    elements.stickKnob.style.left = (50 + x * 34) + "%";
    elements.stickKnob.style.top = (50 + y * 34) + "%";
    elements.aimStick.setAttribute("aria-pressed", "true");
  }

  function releaseStick(event) {
    if (event && event.pointerId !== stickInput.pointerId) return;
    stickInput = { active: false, x: 0, y: 0, pointerId: null };
    elements.stickKnob.style.left = "50%";
    elements.stickKnob.style.top = "50%";
    elements.aimStick.setAttribute("aria-pressed", "false");
  }

  elements.aimStick.addEventListener("pointerdown", function (event) {
    if (phase !== "ready") return;
    event.preventDefault();
    stickInput = { active: true, x: 0, y: 0, pointerId: event.pointerId };
    elements.aimStick.setPointerCapture(event.pointerId);
    updateStickFromPointer(event);
  });
  elements.aimStick.addEventListener("pointermove", updateStickFromPointer);
  elements.aimStick.addEventListener("pointerup", releaseStick);
  elements.aimStick.addEventListener("pointercancel", releaseStick);
  elements.aimStick.addEventListener("lostpointercapture", releaseStick);

  elements.startButton.addEventListener("click", startMatch);
  elements.superShot.addEventListener("click", function () { void takeShot("super"); });
  elements.standardShot.addEventListener("click", function () { void takeShot("standard"); });
  elements.rematchButton.addEventListener("click", resetMatch);

  window.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();
    const directions = { arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right" };
    if (directions[key]) {
      event.preventDefault();
      moveAim(directions[key]);
    } else if (key === "a") {
      event.preventDefault();
      void takeShot("super");
    } else if (key === "b" || key === " ") {
      event.preventDefault();
      void takeShot("standard");
    } else if (key === "enter") {
      if (phase === "intro") startMatch();
      else if (phase === "matchover") resetMatch();
    }
  });

  document.addEventListener("gesturestart", function (event) { event.preventDefault(); }, { passive: false });
  document.addEventListener("contextmenu", function (event) { event.preventDefault(); });

  motionAtlas.addEventListener("load", function () { draw(cssWidth, cssHeight, performance.now()); });
  motionAtlas.addEventListener("error", function () { draw(cssWidth, cssHeight, performance.now()); });
  stadiumMobile.addEventListener("load", function () { resizeCanvas(); });
  stadiumDesktop.addEventListener("load", function () { resizeCanvas(); });
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.parentElement);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }

  updateHud();
  registerWebMCP();
  resizeCanvas();
  window.requestAnimationFrame(frame);
})();

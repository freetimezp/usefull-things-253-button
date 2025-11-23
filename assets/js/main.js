/* -----------------------------------------------------------
   ELECTRIC NETWORK — main.js (UPDATED)
----------------------------------------------------------- */
const app = new PIXI.Application({
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: true,
    powerPreference: "high-performance",
});
document.getElementById("electricStage").appendChild(app.view);

// CONFIG
const NODE_COUNT = 26;
const CONNECTION_DISTANCE = 240;
const NODE_BASE_ALPHA = 0.06;
const NODE_ACTIVE_ALPHA = 1.0;

// Layers
const backgroundLayer = new PIXI.Container();
const lineLayer = new PIXI.Container();
const nodeLayer = new PIXI.Container();
const particleLayer = new PIXI.Container();
const effectLayer = new PIXI.Container();
const uiLayer = new PIXI.Container();
app.stage.addChild(backgroundLayer, lineLayer, nodeLayer, particleLayer, effectLayer, uiLayer);

/* -----------------------------------------------------------
   BACKGROUND GRID
----------------------------------------------------------- */
function drawBackground() {
    const g = new PIXI.Graphics();
    g.beginFill(0x000000, 0.25);
    g.drawRect(0, 0, app.screen.width, app.screen.height);
    g.endFill();

    const grid = new PIXI.Graphics();
    grid.lineStyle(1, 0x0b1016, 0.06);
    const step = 60;

    for (let x = 0; x < app.screen.width; x += step) {
        grid.moveTo(x, 0);
        grid.lineTo(x, app.screen.height);
    }
    for (let y = 0; y < app.screen.height; y += step) {
        grid.moveTo(0, y);
        grid.lineTo(app.screen.width, y);
    }

    g.addChild(grid);
    backgroundLayer.addChild(g);
}
drawBackground();

/* -----------------------------------------------------------
   NODES (with multi-color star shine)
----------------------------------------------------------- */
const nodes = [];

function randomElectricColor() {
    const colors = [
        0x00c8ff, // blue
        0x00ff95, // green
        0xfff95c, // yellow
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function createStarburst(size = 40, spikes = 7, color = 0xffffff) {
    const g = new PIXI.Graphics();
    g.lineStyle(2, color, 1);

    const angleStep = (Math.PI * 2) / spikes;

    for (let i = 0; i < spikes; i++) {
        const a = i * angleStep;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    }

    return app.renderer.generateTexture(g);
}

for (let i = 0; i < NODE_COUNT; i++) {
    const color = randomElectricColor();

    const container = new PIXI.Container();
    container.x = Math.random() * app.screen.width;
    container.y = Math.random() * app.screen.height;

    // BASE DOT
    const core = new PIXI.Graphics();
    core.beginFill(color, NODE_BASE_ALPHA);
    core.drawCircle(0, 0, 3 + Math.random() * 5);
    core.endFill();

    // STAR SHINE
    const star = new PIXI.Sprite(createStarburst(60, 25, color));
    star.anchor.set(0.5);
    star.alpha = 0;
    star.rotation = 0;
    star.scale.set(0.2);

    // SOFT GLOW
    const glow = new PIXI.Graphics();
    glow.beginFill(color, 0.16);
    glow.drawCircle(0, 0, 20);
    glow.endFill();
    glow.alpha = 0;

    container.addChild(glow);
    container.addChild(star);
    container.addChild(core);

    nodeLayer.addChild(container);

    nodes.push({
        container,
        x: container.x,
        y: container.y,
        core,
        star,
        glow,
        activated: false,
    });
}

/* -----------------------------------------------------------
   CONNECTIONS
----------------------------------------------------------- */
const connections = [];
for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
            b = nodes[j];
        const dx = a.x - b.x,
            dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < CONNECTION_DISTANCE) connections.push({ a, b });
    }
}

const staticLines = new PIXI.Graphics();
staticLines.lineStyle(1, 0x66f0ff, 0.05);
connections.forEach((c) => {
    staticLines.moveTo(c.a.x, c.a.y);
    staticLines.lineTo(c.b.x, c.b.y);
});
lineLayer.addChild(staticLines);

/* -----------------------------------------------------------
   SPARK PARTICLES
----------------------------------------------------------- */
function spawnSparks(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
        const p = new PIXI.Graphics();
        p.beginFill(0xffffff);
        p.drawCircle(0, 0, 1.5 + Math.random() * 2);
        p.endFill();
        p.x = x;
        p.y = y;

        particleLayer.addChild(p);

        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        let life = 25 + Math.random() * 20;

        const update = (dt) => {
            p.x += Math.cos(angle) * speed * dt;
            p.y += Math.sin(angle) * speed * dt;
            p.alpha -= 0.03 * dt;
            life -= dt;

            if (life <= 0 || p.alpha <= 0) {
                p.destroy();
                app.ticker.remove(update);
            }
        };
        app.ticker.add(update);
    }
}

/* -----------------------------------------------------------
   ELECTRIC BOLT BETWEEN NODES
----------------------------------------------------------- */
function fireElectricLine(a, b, opts = {}) {
    return new Promise((resolve) => {
        const bolt = new PIXI.Graphics();
        bolt.blendMode = PIXI.BLEND_MODES.ADD;
        effectLayer.addChild(bolt);

        const segments = 18;
        let t = 0;
        const speed = opts.speed || 1;
        const seed = Math.random() * 1000;

        const update = (dt) => {
            t += dt * 0.035 * speed;
            bolt.clear();

            bolt.lineStyle(6, 0x66f0ff, 0.06);
            bolt.moveTo(a.x, a.y);

            for (let i = 1; i < segments; i++) {
                const p = i / segments;
                const px = a.x + (b.x - a.x) * p;
                const py = a.y + (b.y - a.y) * p;
                const n = Math.sin((p * 8 + t * 9 + seed) * 3.4) * 10 * (1 - Math.abs(0.5 - p) * 2);
                bolt.lineTo(px + n, py - n * 0.4);
            }

            bolt.lineTo(b.x, b.y);

            if (t > 1) {
                spawnSparks(b.x, b.y, 8);
                bolt.destroy();
                app.ticker.remove(update);
                resolve();
            }
        };

        app.ticker.add(update);
    });
}

/* -----------------------------------------------------------
   NODE ACTIVATION (STAR + GLOW)
----------------------------------------------------------- */
function glowNode(node) {
    return new Promise((resolve) => {
        const { core, star, glow, x, y } = node;

        spawnSparks(x, y, 6);

        gsap.to(star, { alpha: 1, duration: 0.16 });
        gsap.to(star.scale, { x: 1.6, y: 1.6, duration: 0.2 });
        gsap.to(star.scale, { x: 0.4, y: 0.4, delay: 0.2, duration: 0.35 });

        gsap.to(glow, { alpha: 0.75, duration: 0.22 });
        gsap.to(glow.scale, { x: 1.8, y: 1.8, duration: 0.3 });

        gsap.to(star, {
            rotation: Math.PI * 2,
            duration: 20,
            ease: "power2.out",
        });

        gsap.to(core, {
            alpha: 1,
            duration: 0.15,
            onComplete: () => {
                gsap.to(core, { alpha: 0.8, duration: 0.3 });
                resolve();
            },
        });
    });
}

/* -----------------------------------------------------------
   NETWORK ACTIVATION
----------------------------------------------------------- */
let isAnimating = false;

async function activateNetwork() {
    if (isAnimating) return;
    isAnimating = true;

    for (let i = 0; i < nodes.length; i++) {
        await glowNode(nodes[i]);
        if (i < nodes.length - 1) {
            await fireElectricLine(nodes[i], nodes[i + 1]);
        }
    }

    await fireBeamToLogo(nodes[nodes.length - 1]);
    isAnimating = false;
}

/* -----------------------------------------------------------
   LOGO WITH ELECTRIC BORDER
----------------------------------------------------------- */
let logo, logoBorder;

function createLogo() {
    logo = new PIXI.Text("ELECTRIC LOGO", {
        fontFamily: "Arial Black",
        fontSize: 96,
        fill: 0xffffff,
        align: "center",
    });
    logo.anchor.set(0.5);
    logo.x = app.screen.width / 2;
    logo.y = app.screen.height / 2;
    logo.alpha = 0;

    logoBorder = new PIXI.Graphics();
    logoBorder.blendMode = PIXI.BLEND_MODES.ADD;

    uiLayer.addChild(logoBorder);
    uiLayer.addChild(logo);
}
createLogo();

/* -----------------------------------------------------------
   ELECTRIC BEAM TO LOGO
----------------------------------------------------------- */
async function fireBeamToLogo(lastNode) {
    spawnSparks(lastNode.x, lastNode.y, 12);

    await fireElectricLine(lastNode, { x: logo.x, y: logo.y }, { speed: 1.2 });

    logoShock();
    startElectricLogoBorder();
}

/* -----------------------------------------------------------
   LOGO FLICKER
----------------------------------------------------------- */
function logoShock() {
    gsap.fromTo(logo, { alpha: 0 }, { alpha: 1, duration: 0.12 });
    gsap.to(logo, { alpha: 0.55, duration: 0.05, repeat: 10, yoyo: true });
    gsap.fromTo(logo.scale, { x: 0.9, y: 0.9 }, { x: 1.2, y: 1.2, duration: 0.3 });
}

/* -----------------------------------------------------------
   ELECTRIC BORDER AROUND LOGO (ANIMATED)
----------------------------------------------------------- */
function startElectricLogoBorder() {
    const pad = 30;
    let t = 0;

    app.ticker.add(() => {
        t += 0.08;

        const w = logo.width + pad;
        const h = logo.height + pad;
        const x = logo.x - w / 2;
        const y = logo.y - h / 2;

        logoBorder.clear();
        logoBorder.lineStyle(4, 0x00c8ff, 0.9);

        const steps = 70;

        logoBorder.moveTo(x, y);

        for (let i = 1; i <= steps; i++) {
            const p = i / steps;

            let px, py;

            // trace a rectangle border
            if (p < 0.25) {
                px = x + p * 4 * w;
                py = y;
            } else if (p < 0.5) {
                px = x + w;
                py = y + (p - 0.25) * 4 * h;
            } else if (p < 0.75) {
                px = x + w - (p - 0.5) * 4 * w;
                py = y + h;
            } else {
                px = x;
                py = y + h - (p - 0.75) * 4 * h;
            }

            const noise = Math.sin(i * 0.4 + t * 3) * 6;
            logoBorder.lineTo(px + noise, py - noise);
        }
    });
}

/* -----------------------------------------------------------
   BUTTON
----------------------------------------------------------- */
document.getElementById("activateBtn").addEventListener("click", activateNetwork);

/* -----------------------------------------------------------
   IDLE BREATHING
----------------------------------------------------------- */
app.ticker.add((dt) => {
    nodes.forEach((n, i) => {
        const s = 1 + Math.sin((app.ticker.lastTime * 0.001 + i) * 0.6) * 0.02;
        n.core.scale.set(s);
    });
});

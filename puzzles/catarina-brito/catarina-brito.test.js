// Todos os testes do puzzle da Catarina — um tangram de 7 peças, sem ajudas: a
// caixa está vazia e cada peça tem de ser rodada e largada no sítio certo. O
// ficheiro é autónomo: não importa nada de outros puzzles, para que cada pasta
// possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "Catarina";
const SLUG = "catarina-brito";
const TOTAL = 7;
const UNIT = 4;              // o quadrado do tangram tem 4 unidades de lado
const STEP = 45;             // cada toque roda a peça um oitavo de volta
const BOARD = 400;           // o tamanho que damos à caixa nos testes, em píxeis
const PIXELS = BOARD / UNIT; // píxeis por unidade do quadrado

const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;

const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

let dom = null;

/** Gerador determinista, para que as peças saiam sempre iguais. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * O jsdom não faz contas de layout: sem isto a caixa mediria zero e não haveria
 * onde largar as peças. Damos-lhe um tamanho fixo, e assim uma unidade do
 * quadrado vale PIXELS píxeis — é o que deixa os testes apontar a sítios certos.
 */
function openPage({ seed = 20260814 } = {}) {
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: PAGE_URL,
    beforeParse(window) {
      window.Math.random = seededRandom(seed);
    },
  });
  const { document } = dom.window;
  document.querySelector("#boardWrap").getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, right: BOARD, bottom: BOARD, width: BOARD, height: BOARD,
  });
  return document;
}

/** As peças que ainda estão por pôr, pela ordem em que aparecem na tábua. */
const trayOrder = (document) =>
  [...document.querySelectorAll(".piece")].map((piece) => Number(piece.dataset.piece));

const pieceButton = (document, piece) => document.querySelector(`.piece[data-piece="${piece}"]`);
const angleOf = (document, piece) => Number(pieceButton(document, piece).dataset.angle);
const placedPieces = (document) =>
  [...document.querySelectorAll(".placed-piece")].map((held) => Number(held.dataset.placed));

/** Os cantos da peça, lidos do recorte do seu desenho: "M 0 0 L 4 0 L 2 2 Z". */
function cornersOf(document, piece) {
  const shape = pieceButton(document, piece).querySelector("clipPath path").getAttribute("d");
  return shape
    .replace(/^M\s*/, "")
    .replace(/\s*Z$/, "")
    .split("L")
    .map((corner) => corner.trim().split(/\s+/).map(Number));
}

/** O centro de gravidade da peça: é ali que ela tem de ser largada. */
const centreOf = (corners) => ({
  x: corners.reduce((sum, [x]) => sum + x, 0) / corners.length,
  y: corners.reduce((sum, [, y]) => sum + y, 0) / corners.length,
});

/** Fórmula do sapateiro: a área de um polígono a partir dos seus cantos. */
const areaOf = (corners) =>
  Math.abs(
    corners.reduce((total, [x, y], index) => {
      const [nextX, nextY] = corners[(index + 1) % corners.length];
      return total + x * nextY - nextX * y;
    }, 0),
  ) / 2;

/** Os comprimentos dos lados, arredondados, para reconhecer a forma da peça. */
const sidesOf = (corners) =>
  corners.map(([x, y], index) => {
    const [nextX, nextY] = corners[(index + 1) % corners.length];
    return Number(Math.hypot(nextX - x, nextY - y).toFixed(3));
  });

/** Um toque na caixa, no ponto (x, y) dado em unidades do quadrado. */
function tapBoard(document, point) {
  document.querySelector("#boardWrap").dispatchEvent(
    new dom.window.MouseEvent("click", {
      bubbles: true,
      clientX: point.x * PIXELS,
      clientY: point.y * PIXELS,
    }),
  );
}

const pickUp = (document, piece) => pieceButton(document, piece).click();

/** Um evento de ponteiro num sítio do ecrã — é assim que se arrasta uma peça. */
function pointer(element, type, clientX, clientY) {
  element.dispatchEvent(
    new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }),
  );
}

/** Arrasta a peça, com o dedo, da tábua até um ponto da caixa. */
function dragTo(document, piece, point) {
  const button = pieceButton(document, piece);
  const wrap = document.querySelector("#boardWrap");
  pointer(button, "pointerdown", 10, 10);
  pointer(wrap, "pointermove", point.x * PIXELS, point.y * PIXELS);
  pointer(wrap, "pointerup", point.x * PIXELS, point.y * PIXELS);
}

/** Roda a peça até ficar direita — é assim que se joga, um toque de cada vez. */
function straighten(document, piece) {
  let turns = 0;
  while (angleOf(document, piece) !== 0) {
    pieceButton(document, piece).click();
    turns += 1;
    if (turns > 360 / STEP) throw new Error("a peça nunca fica direita");
  }
  return turns;
}

/** Pega na peça, endireita-a e larga-a no lugar dela. */
function settle(document, piece) {
  pickUp(document, piece);
  straighten(document, piece);
  tapBoard(document, centreOf(cornersOf(document, piece)));
}

function solve(document) {
  trayOrder(document).forEach((piece) => settle(document, piece));
}

afterEach(() => {
  dom?.window.close();
  dom = null;
});

describe(`Puzzle da ${PERSON} — página`, () => {
  it("anuncia a pessoa no título e no cabeçalho", () => {
    const document = openPage();
    expect(document.title).toContain(PERSON);
    expect(document.querySelector("h1").textContent).toContain(PERSON);
  });

  it("aponta as ligações públicas para a pasta do próprio puzzle", () => {
    const document = openPage();

    expect(document.querySelector('link[rel="canonical"]').href).toBe(PAGE_URL);
    expect(document.querySelector('meta[property="og:url"]').content).toBe(PAGE_URL);
    expect(document.querySelector('meta[property="og:image"]').content).toBe(`${PAGE_URL}assets/og-image.jpg`);
    expect(document.querySelector('meta[name="twitter:image"]').content).toBe(`${PAGE_URL}assets/og-image.jpg`);
  });

  it("é autónoma: só usa ficheiros da sua própria pasta", () => {
    expect(html).not.toContain("../");
    const document = openPage();
    document.querySelectorAll("script[src], link[href], img[src]").forEach((element) => {
      const reference = element.getAttribute("src") ?? element.getAttribute("href");
      const isLocal = reference.startsWith("./");
      const isAbsoluteUrl = /^https?:\/\//.test(reference);
      expect(isLocal || isAbsoluteUrl).toBe(true);
    });
  });

  it("tem todos os ficheiros que a página pede à sua pasta", () => {
    const references = [...html.matchAll(/\.\/(assets\/[\w.-]+)/g)].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    new Set(references).forEach((reference) => {
      expect(existsSync(resolve(puzzleDir, reference)), `falta ${reference}`).toBe(true);
    });
  });
});

describe(`Puzzle da ${PERSON} — as sete peças do tangram`, () => {
  it("dá sete peças por pôr e uma caixa vazia", () => {
    const document = openPage();

    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL);
    expect(document.querySelectorAll(".placed-piece")).toHaveLength(0);
    expect(trayOrder(document).slice().sort((a, b) => a - b)).toEqual([...Array(TOTAL).keys()]);
    expect(document.querySelector("#placedCount").textContent).toBe(`0/${TOTAL}`);
  });

  it("não mostra em lado nenhum onde é o lugar de cada peça", () => {
    const document = openPage();

    // Nem contornos gravados no fundo, nem lugares para tocar: a caixa é lisa.
    expect(document.querySelector("#board").querySelector("svg")).toBe(null);
    expect(document.querySelectorAll(".slot")).toHaveLength(0);
    expect(document.querySelectorAll(".engraving")).toHaveLength(0);
    // A mira só aparece depois de se pegar numa peça.
    expect(document.querySelector("#aim").hidden).toBe(true);
  });

  it("é mesmo o tangram: dois triângulos grandes, um médio, dois pequenos, um quadrado e um paralelogramo", () => {
    const document = openPage();
    const shapes = [...Array(TOTAL).keys()].map((piece) => {
      const corners = cornersOf(document, piece);
      return { corners: corners.length, area: areaOf(corners), sides: sidesOf(corners) };
    });

    const areas = shapes.map((shape) => shape.area).sort((a, b) => a - b);
    expect(areas).toEqual([1, 1, 2, 2, 2, 4, 4]);

    const triangles = shapes.filter((shape) => shape.corners === 3);
    const quadrilaterals = shapes.filter((shape) => shape.corners === 4);
    expect(triangles).toHaveLength(5);
    expect(quadrilaterals).toHaveLength(2);

    // Os cinco triângulos são rectângulos isósceles, em três tamanhos: os dois
    // grandes com catetos 2√2, o médio com catetos 2 e os dois pequenos com √2.
    const legs = triangles.map((shape) => Math.min(...shape.sides)).sort((a, b) => a - b);
    expect(legs).toEqual([1.414, 1.414, 2, 2.828, 2.828]);

    // O quadrado tem os quatro lados iguais; o paralelogramo tem-nos dois a dois.
    const square = quadrilaterals.find((shape) => new Set(shape.sides).size === 1);
    const parallelogram = quadrilaterals.find((shape) => new Set(shape.sides).size === 2);
    expect(square.sides).toEqual([1.414, 1.414, 1.414, 1.414]);
    expect(parallelogram.sides.slice().sort()).toEqual([1.414, 1.414, 2, 2]);
  });

  it("as peças enchem o quadrado todo, sem folgas nem sobreposições", () => {
    const document = openPage();
    const pieces = [...Array(TOTAL).keys()].map((piece) => cornersOf(document, piece));

    const total = pieces.reduce((sum, corners) => sum + areaOf(corners), 0);
    expect(total).toBe(UNIT * UNIT);

    pieces.flat().forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(UNIT);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(UNIT);
    });
  });

  it("recorta cada peça num bocado diferente da mesma fotografia", () => {
    const document = openPage();
    const clipIds = new Set();
    const windows = new Set();

    document.querySelectorAll(".piece svg").forEach((svg) => {
      const clip = svg.querySelector("clipPath");
      const image = svg.querySelector("image");

      // A fotografia entra sempre inteira e no mesmo sítio; o que muda de peça
      // para peça é o recorte e a janela por onde se olha (o viewBox).
      expect(image.getAttribute("href")).toBe("./assets/photo.jpg");
      expect(image.getAttribute("x")).toBe("0");
      expect(image.getAttribute("y")).toBe("0");
      expect(Number(image.getAttribute("width"))).toBe(UNIT);
      expect(image.getAttribute("clip-path")).toBe(`url(#${clip.id})`);

      clipIds.add(clip.id);
      windows.add(svg.getAttribute("viewBox"));
    });

    expect(clipIds.size).toBe(TOTAL);
    expect(windows.size).toBe(TOTAL);
  });

  it("dá a cada peça na tábua o espaço que ela ocupa a rodar", () => {
    const document = openPage();

    [...Array(TOTAL).keys()].forEach((piece) => {
      const corners = cornersOf(document, piece);
      const centre = centreOf(corners);
      const reach = Math.max(...corners.map(([x, y]) => Math.hypot(x - centre.x, y - centre.y)));

      // --r é a roda que a peça desenha ao girar: nunca sai da sua caixa, e o
      // triângulo grande continua a ser bem maior do que o pequeno.
      expect(Number(pieceButton(document, piece).style.getPropertyValue("--r"))).toBeCloseTo(
        (reach * 2) / UNIT,
      );
    });
  });

  it.each([1, 7, 42, 2026, 20260814])(
    "baralha as peças e torce-as todas (semente %i)",
    (seed) => {
      const document = openPage({ seed });
      const angles = [...Array(TOTAL).keys()].map((piece) => angleOf(document, piece));

      // Nenhuma peça começa direita: todas têm mesmo de ser rodadas.
      expect(angles.every((angle) => angle !== 0)).toBe(true);
      expect(angles.every((angle) => angle % STEP === 0 && angle < 360)).toBe(true);
      expect(trayOrder(document)).not.toEqual([...Array(TOTAL).keys()]);
    },
  );
});

describe(`Puzzle da ${PERSON} — rodar e largar`, () => {
  it("pega na peça ao primeiro toque e roda-a nos seguintes", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const before = angleOf(document, piece);

    pickUp(document, piece);
    expect(pieceButton(document, piece).classList.contains("is-selected")).toBe(true);
    expect(angleOf(document, piece)).toBe(before);   // pegar não roda

    pieceButton(document, piece).click();
    expect(angleOf(document, piece)).toBe((before + STEP) % 360);
    expect(pieceButton(document, piece).style.getPropertyValue("--angle")).toBe(
      `${(before + STEP) % 360}deg`,
    );
  });

  it("dá a volta completa ao fim de oito toques", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const before = angleOf(document, piece);

    pickUp(document, piece);
    for (let turn = 0; turn < 360 / STEP; turn += 1) pieceButton(document, piece).click();

    expect(angleOf(document, piece)).toBe(before);
  });

  it("roda também pelo botão, e só com uma peça na mão", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const rotate = document.querySelector("#rotateButton");

    expect(rotate.disabled).toBe(true);

    pickUp(document, piece);
    const before = angleOf(document, piece);
    expect(rotate.disabled).toBe(false);

    rotate.click();
    expect(angleOf(document, piece)).toBe((before + STEP) % 360);
  });

  it("mostra a mira, no ângulo da peça, onde o dedo aponta", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const aim = document.querySelector("#aim");

    pickUp(document, piece);
    expect(aim.hidden).toBe(true);   // ainda não se apontou a nenhum sítio

    // Aponta-se ao meio da caixa sem largar (é o que o rato faz ao passar).
    document.querySelector("#boardWrap").dispatchEvent(
      new dom.window.MouseEvent("pointermove", {
        bubbles: true, clientX: 2 * PIXELS, clientY: 2 * PIXELS,
      }),
    );

    expect(aim.hidden).toBe(false);
    expect(aim.style.left).toBe("50%");
    expect(aim.style.top).toBe("50%");
    expect(aim.style.getPropertyValue("--angle")).toBe(`${angleOf(document, piece)}deg`);
  });

  it("assenta a peça quando está direita e cai no lugar certo", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];

    settle(document, piece);

    expect(placedPieces(document)).toEqual([piece]);
    expect(pieceButton(document, piece)).toBe(null);
    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL - 1);
    expect(document.querySelector("#placedCount").textContent).toBe(`1/${TOTAL}`);
    // Na caixa, a peça mostra o quadrado inteiro: é assim que casa com as outras.
    expect(document.querySelector(".placed-piece svg").getAttribute("viewBox")).toBe(`0 0 ${UNIT} ${UNIT}`);
    // E a mão fica vazia.
    expect(document.querySelector("#aim").hidden).toBe(true);
    expect(document.querySelector("#rotateButton").disabled).toBe(true);
  });

  it("não assenta a peça direita se for largada fora do lugar dela", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const home = centreOf(cornersOf(document, piece));

    pickUp(document, piece);
    straighten(document, piece);
    // Uma unidade ao lado: bem mais do que a folga de 0,42.
    tapBoard(document, { x: (home.x + 1) % UNIT, y: home.y });

    expect(placedPieces(document)).toEqual([]);
    expect(pieceButton(document, piece)).not.toBe(null);
    expect(document.querySelector("#boardWrap").classList.contains("is-wrong")).toBe(true);
    expect(document.querySelector("#placedCount").textContent).toBe(`0/${TOTAL}`);
  });

  it("não assenta a peça torta, mesmo caindo no lugar certo", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const home = centreOf(cornersOf(document, piece));

    pickUp(document, piece);
    straighten(document, piece);
    pieceButton(document, piece).click();     // torce-a um oitavo de volta
    expect(angleOf(document, piece)).toBe(STEP);

    tapBoard(document, home);

    // A forma até encaixava, mas a fotografia que ela leva ficava virada.
    expect(placedPieces(document)).toEqual([]);
    expect(document.querySelector("#boardWrap").classList.contains("is-wrong")).toBe(true);
  });

  it("aceita a peça em qualquer ponto dentro da folga", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const home = centreOf(cornersOf(document, piece));

    pickUp(document, piece);
    straighten(document, piece);
    tapBoard(document, { x: home.x + 0.3, y: home.y - 0.2 });   // 0,36 do centro

    expect(placedPieces(document)).toEqual([piece]);
  });

  it("arrasta a peça da tábua para dentro da caixa", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];

    pickUp(document, piece);
    straighten(document, piece);
    dragTo(document, piece, centreOf(cornersOf(document, piece)));

    expect(placedPieces(document)).toEqual([piece]);
    expect(document.querySelector("#placedCount").textContent).toBe(`1/${TOTAL}`);
  });

  it("larga o arrasto fora da caixa sem rodar a peça sem querer", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const button = pieceButton(document, piece);
    pickUp(document, piece);
    const before = angleOf(document, piece);

    // Arrasta e larga ao lado da caixa: a peça fica na mão, tal como estava.
    pointer(button, "pointerdown", 10, 10);
    pointer(button, "pointermove", 30, 900);
    pointer(button, "pointerup", 30, 900);
    // O browser manda um clique a seguir ao arrasto — este não pode contar.
    button.click();

    expect(placedPieces(document)).toEqual([]);
    expect(angleOf(document, piece)).toBe(before);
    expect(button.classList.contains("is-selected")).toBe(true);

    // E o toque seguinte, esse, volta a rodar como sempre.
    button.click();
    expect(angleOf(document, piece)).toBe((before + STEP) % 360);
  });

  it("não faz nada quando se toca na caixa sem peça na mão", () => {
    const document = openPage();

    tapBoard(document, { x: 2, y: 2 });

    expect(placedPieces(document)).toEqual([]);
    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL);
  });

  it("larga a peça da mão com a tecla Escape", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];

    pickUp(document, piece);
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(pieceButton(document, piece).classList.contains("is-selected")).toBe(false);
    expect(document.querySelector("#rotateButton").disabled).toBe(true);
  });

  it("também se joga com o teclado: as setas movem a peça e o Enter larga-a", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const wrap = document.querySelector("#boardWrap");
    const press = (key) => wrap.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true }));

    pickUp(document, piece);
    straighten(document, piece);

    // A mira começa no meio da caixa e anda 0,2 unidades de cada vez.
    const home = centreOf(cornersOf(document, piece));
    press("ArrowRight");
    expect(document.querySelector("#aim").hidden).toBe(false);

    const steps = (from, to) => Math.round((to - from) / 0.2);
    for (let step = 0; step < Math.abs(steps(2.2, home.x)); step += 1) press(home.x > 2.2 ? "ArrowRight" : "ArrowLeft");
    for (let step = 0; step < Math.abs(steps(2, home.y)); step += 1) press(home.y > 2 ? "ArrowDown" : "ArrowUp");
    press("Enter");

    expect(placedPieces(document)).toEqual([piece]);
  });

  it("volta ao início quando se começa de novo", () => {
    const document = openPage();
    settle(document, trayOrder(document)[0]);
    expect(document.querySelector("#placedCount").textContent).toBe(`1/${TOTAL}`);

    document.querySelector("#shuffleButton").click();

    expect(document.querySelector("#placedCount").textContent).toBe(`0/${TOTAL}`);
    expect(document.querySelector("#timer").textContent).toBe("0:00");
    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL);
    expect(document.querySelectorAll(".placed-piece")).toHaveLength(0);
  });
});

describe(`Puzzle da ${PERSON} — fotografia e final`, () => {
  it("mostra e esconde a pré-visualização da fotografia", () => {
    const document = openPage();
    const preview = document.querySelector("#preview");
    const button = document.querySelector("#previewButton");

    button.click();
    expect(preview.classList.contains("visible")).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    button.click();
    expect(preview.classList.contains("visible")).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("festeja com o nome da pessoa quando a última peça assenta", async () => {
    const document = openPage();
    solve(document);

    expect(placedPieces(document).sort((a, b) => a - b)).toEqual([...Array(TOTAL).keys()]);
    expect(document.querySelectorAll(".piece")).toHaveLength(0);
    expect(document.querySelector("#placedCount").textContent).toBe(`${TOTAL}/${TOTAL}`);
    // Com o tangram feito, os cortes desaparecem e fica só a fotografia.
    expect(document.querySelector("#board").classList.contains("is-solved")).toBe(true);

    // A festa dá os parabéns pelo nome, tanto no título como no texto.
    expect(document.querySelector("#celebrationTitle").textContent).toContain(PERSON);

    const text = document.querySelector("#celebrationText").textContent;
    expect(text).toContain(PERSON);
    expect(text).toContain(`${TOTAL} tentativas`);

    await new Promise((done) => dom.window.setTimeout(done, 1500));
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#celebration").getAttribute("aria-hidden")).toBe("false");
  });

  it("conta as tentativas falhadas até ao fim", async () => {
    const document = openPage();
    const first = trayOrder(document)[0];

    pickUp(document, first);
    straighten(document, first);
    tapBoard(document, { x: 0.1, y: 3.9 });   // uma tentativa a mais, no sítio errado
    solve(document);

    expect(document.querySelector("#celebrationText").textContent).toContain(`${TOTAL + 1} tentativas`);
  });

  it("ignora toques depois de o tangram estar feito", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 1500));

    tapBoard(document, { x: 2, y: 2 });

    expect(placedPieces(document)).toHaveLength(TOTAL);
    expect(document.querySelector("#placedCount").textContent).toBe(`${TOTAL}/${TOTAL}`);
  });

  it("fecha a festa com a tecla Escape", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 1500));

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
  });

  it("recomeça o jogo a partir da festa", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 1500));

    document.querySelector("#playAgainButton").click();

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    expect(document.querySelector("#placedCount").textContent).toBe(`0/${TOTAL}`);
    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL);
    expect(document.querySelector("#board").classList.contains("is-solved")).toBe(false);
  });
});

// Todos os testes do puzzle do Filipe e do Francisco. O ficheiro é autónomo: não
// importa nada de outros puzzles, para que cada pasta possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PEOPLE = ["Filipe", "Francisco"];
const SLUG = "filipe-francisco";
const COLS = 4;
const ROWS = 6;
const BOXES = COLS * ROWS;
const H_EDGES = COLS * (ROWS + 1);
const V_EDGES = (COLS + 1) * ROWS;
const EDGES = H_EDGES + V_EDGES;
const DOTS = (COLS + 1) * (ROWS + 1);
// A página dá tempo a ver o campo já todo fotografia antes de abrir a festa.
const PARTY_DELAY = 2500;

const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;

const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

let dom = null;

/**
 * A página abre-se tal como está. Este jogo não sorteia nada — começa sempre
 * o mesmo jogador e os riscos fazem sempre o mesmo —, por isso não é preciso
 * semente nenhuma para os testes serem repetíveis.
 */
function openPage() {
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: PAGE_URL,
  });
  return dom.window.document;
}

const horizontalKey = (row, column) => `h-${row}-${column}`;
const verticalKey = (row, column) => `v-${row}-${column}`;

const field = (document) => document.querySelector("#field");
const at = (document, key) => field(document).dataset[key];
const turnOf = (document) => Number(at(document, "turn"));
const scoresOf = (document) => [Number(at(document, "scoreA")), Number(at(document, "scoreB"))];
const takenOf = (document) => Number(at(document, "taken"));
const isFinished = (document) => at(document, "finished") === "true";

const edgeAt = (document, key) => document.querySelector(`.edge[data-edge="${key}"]`);
const boxAt = (document, row, column) => document.querySelectorAll(".box")[row * COLS + column];
const draw = (document, key) => edgeAt(document, key).click();

/** Os quatro lados de uma caixa, pela mesma ordem em que a página os lê. */
const sidesOf = (row, column) => [
  horizontalKey(row, column),
  horizontalKey(row + 1, column),
  verticalKey(row, column),
  verticalKey(row, column + 1),
];

/** Fecha a caixa indicada, deixando o último lado por riscar. */
function surround(document, row, column) {
  const sides = sidesOf(row, column);
  sides.slice(0, 3).forEach((side) => draw(document, side));
  return sides[3];
}

/** Risca o campo todo. A ordem não importa: no fim as 24 caixas estão fechadas. */
function playWholeGame(document) {
  for (let row = 0; row <= ROWS; row += 1) {
    for (let column = 0; column < COLS; column += 1) draw(document, horizontalKey(row, column));
  }
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column <= COLS; column += 1) draw(document, verticalKey(row, column));
  }
}

afterEach(() => {
  dom?.window.close();
  dom = null;
});

describe("Puzzle do Filipe e do Francisco — página", () => {
  it("anuncia as duas pessoas no título e no cabeçalho", () => {
    const document = openPage();
    const heading = document.querySelector("h1").textContent;

    PEOPLE.forEach((person) => {
      expect(document.title).toContain(person);
      expect(heading).toContain(person);
    });
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

describe("Puzzle do Filipe e do Francisco — campo", () => {
  it("desenha as caixas, os riscos e os pontos do caderno", () => {
    const document = openPage();

    expect(document.querySelectorAll(".box")).toHaveLength(BOXES);
    expect(document.querySelectorAll(".edge")).toHaveLength(EDGES);
    expect(document.querySelectorAll(".edge.h")).toHaveLength(H_EDGES);
    expect(document.querySelectorAll(".edge.v")).toHaveLength(V_EDGES);
    expect(document.querySelectorAll(".dot")).toHaveLength(DOTS);
  });

  it("começa com o campo limpo e a vez do Filipe", () => {
    const document = openPage();

    expect(turnOf(document)).toBe(0);
    expect(scoresOf(document)).toEqual([0, 0]);
    expect(takenOf(document)).toBe(0);
    expect(isFinished(document)).toBe(false);
    expect(document.querySelectorAll(".edge.is-drawn")).toHaveLength(0);
    expect(document.querySelectorAll(".box.is-taken")).toHaveLength(0);
    expect(document.querySelector("#turnLine").textContent).toContain("Filipe");
  });

  it("dá a cada caixa o seu bocado da fotografia, sem duas repetidas", () => {
    const document = openPage();
    const positions = [...document.querySelectorAll(".box")].map((box) => box.style.backgroundPosition);

    expect(new Set(positions).size).toBe(BOXES);
    expect(positions[0]).toBe("0% 0%");
    expect(positions[BOXES - 1]).toBe("100% 100%");
  });
});

describe("Puzzle do Filipe e do Francisco — as regras", () => {
  it("passa a vez a quem não fecha caixa nenhuma", () => {
    const document = openPage();

    draw(document, horizontalKey(0, 0));
    expect(turnOf(document)).toBe(1);
    expect(edgeAt(document, horizontalKey(0, 0)).dataset.owner).toBe("0");

    draw(document, horizontalKey(0, 1));
    expect(turnOf(document)).toBe(0);
    expect(edgeAt(document, horizontalKey(0, 1)).dataset.owner).toBe("1");
  });

  it("não deixa riscar duas vezes o mesmo lado", () => {
    const document = openPage();

    draw(document, verticalKey(2, 2));
    expect(turnOf(document)).toBe(1);

    draw(document, verticalKey(2, 2));
    expect(turnOf(document)).toBe(1);
    expect(document.querySelectorAll(".edge.is-drawn")).toHaveLength(1);
  });

  it("quem fecha uma caixa fica com ela e joga outra vez", () => {
    const document = openPage();
    // Três riscos que não fecham nada passam a vez três vezes — 0, 1, 0 —,
    // portanto o quarto, o que fecha a caixa, é do Francisco.
    const lastSide = surround(document, 0, 0);
    const closer = turnOf(document);
    expect(closer).toBe(1);

    draw(document, lastSide);

    const box = boxAt(document, 0, 0);
    expect(box.dataset.owner).toBe(String(closer));
    expect(box.classList.contains("is-taken")).toBe(true);

    const scores = scoresOf(document);
    expect(scores[closer]).toBe(1);
    expect(scores[1 - closer]).toBe(0);
    // Fechou, logo continua a ser a vez dele.
    expect(turnOf(document)).toBe(closer);
  });

  it("conta duas caixas ao risco que fecha as duas de uma vez", () => {
    const document = openPage();
    const shared = horizontalKey(1, 0);
    // Tudo à volta das duas caixas de cima da primeira coluna, menos o risco
    // do meio, que fica para o fim.
    const around = [...sidesOf(0, 0), ...sidesOf(1, 0)].filter((side) => side !== shared);
    new Set(around).forEach((side) => draw(document, side));

    const before = scoresOf(document);
    expect(before[0] + before[1]).toBe(0);

    const player = turnOf(document);
    draw(document, shared);

    const after = scoresOf(document);
    expect(after[player]).toBe(2);
    expect(boxAt(document, 0, 0).dataset.owner).toBe(String(player));
    expect(boxAt(document, 1, 0).dataset.owner).toBe(String(player));
    expect(turnOf(document)).toBe(player);
  });
});

describe("Puzzle do Filipe e do Francisco — o fim do jogo", () => {
  it("fecha as 24 caixas e reparte-as todas pelos dois", () => {
    const document = openPage();
    playWholeGame(document);

    const [first, second] = scoresOf(document);
    expect(first + second).toBe(BOXES);
    expect(takenOf(document)).toBe(BOXES);
    expect(document.querySelectorAll(".box.is-taken")).toHaveLength(BOXES);
    expect(document.querySelectorAll(".edge.is-drawn")).toHaveLength(EDGES);
    [...document.querySelectorAll(".box")].forEach((box) => {
      expect(["0", "1"]).toContain(box.dataset.owner);
    });
  });

  it("levanta a grelha e deixa só o mosaico das duas fotografias", () => {
    const document = openPage();
    playWholeGame(document);

    expect(isFinished(document)).toBe(true);
    expect(field(document).classList.contains("is-complete")).toBe(true);
    expect(document.querySelector("#boxesLeft").textContent).toBe("0");
    [...document.querySelectorAll(".edge")].forEach((edge) => {
      expect(edge.disabled).toBe(true);
    });
  });

  it("abre a festa com os dois nomes e o resultado", async () => {
    const document = openPage();
    playWholeGame(document);

    const celebration = document.querySelector("#celebration");
    expect(celebration.classList.contains("visible")).toBe(false);

    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    expect(celebration.classList.contains("visible")).toBe(true);
    expect(celebration.getAttribute("aria-hidden")).toBe("false");

    const scores = scoresOf(document);
    const captions = [document.querySelector("#cardCaptionA"), document.querySelector("#cardCaptionB")];
    captions.forEach((caption, index) => {
      expect(caption.textContent).toContain(PEOPLE[index]);
      expect(caption.textContent).toContain(String(scores[index]));
    });

    const message = document.querySelector("#celebrationText").textContent;
    PEOPLE.forEach((person) => expect(message).toContain(person));
  });

  it("dá a coroa a quem ficou com mais caixas", async () => {
    const document = openPage();
    playWholeGame(document);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    const [first, second] = scoresOf(document);
    const title = document.querySelector("#celebrationTitle").textContent;
    const photos = [document.querySelector("#cardPhotoA"), document.querySelector("#cardPhotoB")];

    if (first === second) {
      expect(title).toContain("Empate");
      photos.forEach((photo) => expect(photo.classList.contains("is-winner")).toBe(false));
      return;
    }

    const winner = first > second ? 0 : 1;
    expect(title).toContain(PEOPLE[winner]);
    expect(photos[winner].classList.contains("is-winner")).toBe(true);
    expect(photos[1 - winner].classList.contains("is-winner")).toBe(false);
  });
});

describe("Puzzle do Filipe e do Francisco — recomeçar", () => {
  it("limpa o campo e passa a estreia ao outro jogador", async () => {
    const document = openPage();
    playWholeGame(document);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    document.querySelector("#playAgainButton").click();

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    expect(scoresOf(document)).toEqual([0, 0]);
    expect(takenOf(document)).toBe(0);
    expect(isFinished(document)).toBe(false);
    expect(document.querySelectorAll(".edge.is-drawn")).toHaveLength(0);
    expect(document.querySelectorAll(".box.is-taken")).toHaveLength(0);
    expect(field(document).classList.contains("is-complete")).toBe(false);
    // O primeiro jogo é do Filipe, o segundo do Francisco.
    expect(turnOf(document)).toBe(1);
    expect(document.querySelector("#turnLine").textContent).toContain("Francisco");
  });

  it("não deixa a festa do jogo anterior entrar por cima do novo", async () => {
    const document = openPage();
    playWholeGame(document);
    document.querySelector("#newGameButton").click();

    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    expect(takenOf(document)).toBe(0);
  });
});

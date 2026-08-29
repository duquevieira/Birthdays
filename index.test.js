// Testes da página inicial. Além do índice em si, guardam a pré-visualização das
// ligações: é o que o WhatsApp lê quando se partilha o endereço.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const SITE_URL = "https://duquevieira.github.io/Birthdays/";

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(root, "index.html"), "utf8");
const workflow = readFileSync(resolve(root, ".github/workflows/pages.yml"), "utf8");

const { document } = new JSDOM(html, { url: SITE_URL }).window;

const meta = (selector) => document.querySelector(selector)?.content;

/** Largura e altura de um JPEG, lidas do marcador SOF. */
function jpegSize(path) {
  const file = readFileSync(path);
  for (let at = 2; at < file.length; ) {
    if (file[at] !== 0xff) throw new Error("não é um JPEG válido");
    const marker = file[at + 1];
    const length = file.readUInt16BE(at + 2);
    // SOF0..SOF15, tirando os marcadores que não descrevem a imagem.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: file.readUInt16BE(at + 5), width: file.readUInt16BE(at + 7) };
    }
    at += 2 + length;
  }
  throw new Error("não encontrei o tamanho da imagem");
}

const puzzleLinks = [...document.querySelectorAll(".puzzle-link")];

/** A fotografia que a ligação mostra, tal como está escrita no background-image. */
const photoOf = (link) =>
  link.querySelector(".puzzle-photo").style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, "");

describe("Página inicial", () => {
  it("lista as pessoas com ligação para o puzzle de cada uma", () => {
    expect(puzzleLinks.length).toBeGreaterThan(0);

    puzzleLinks.forEach((link) => {
      const href = link.getAttribute("href");
      expect(href.startsWith("./puzzles/")).toBe(true);
      expect(existsSync(resolve(root, href, "index.html")), `falta ${href}index.html`).toBe(true);
    });
  });

  it("dá a cada ligação a fotografia da própria pessoa", () => {
    const photos = puzzleLinks.map(photoOf);

    photos.forEach((photo, index) => {
      // A fotografia tem de vir da pasta da própria pessoa, e existir.
      expect(photo.startsWith(puzzleLinks[index].getAttribute("href"))).toBe(true);
      expect(existsSync(resolve(root, photo)), `falta ${photo}`).toBe(true);
    });

    expect(new Set(photos).size).toBe(photos.length);
  });

  it("dá a cada ligação o seu próprio texto", () => {
    const texts = puzzleLinks.map((link) =>
      [".puzzle-name", ".puzzle-kind", ".puzzle-date"].map((part) =>
        link.querySelector(part).textContent.trim(),
      ),
    );

    texts.forEach((parts) => parts.forEach((text) => expect(text).not.toBe("")));
    // O nome e o tipo de puzzle são de cada pessoa; a data pode repetir-se,
    // porque há pessoas que fazem anos no mesmo dia.
    ["nome", "tipo de puzzle"].forEach((_, part) => {
      const values = texts.map((parts) => parts[part]);
      expect(new Set(values).size).toBe(values.length);
    });
  });
});

describe("Pré-visualização de cada puzzle", () => {
  it.each(puzzleLinks.map((link) => link.getAttribute("href")))(
    "%s tem imagem e texto só seus",
    (href) => {
      const page = readFileSync(resolve(root, href, "index.html"), "utf8");
      const { document: puzzle } = new JSDOM(page).window;
      const card = (selector) => puzzle.querySelector(selector).content;

      expect(card('meta[property="og:image"]')).toBe(
        `${SITE_URL}${href.replace("./", "")}assets/og-image.jpg`,
      );
      expect(existsSync(resolve(root, href, "assets/og-image.jpg"))).toBe(true);

      // O título e o texto não podem ser os mesmos dos outros puzzles.
      const others = puzzleLinks
        .map((link) => link.getAttribute("href"))
        .filter((other) => other !== href)
        .map((other) => readFileSync(resolve(root, other, "index.html"), "utf8"));

      [card('meta[property="og:title"]'), card('meta[property="og:description"]')].forEach((text) => {
        expect(text.length).toBeGreaterThan(10);
        others.forEach((other) => expect(other).not.toContain(text));
      });
    },
  );
});

describe("Pré-visualização das ligações", () => {
  it("tem os cartões que o WhatsApp e as redes sociais lêem", () => {
    expect(document.querySelector('link[rel="canonical"]').href).toBe(SITE_URL);
    expect(meta('meta[property="og:url"]')).toBe(SITE_URL);
    expect(meta('meta[property="og:title"]')).toBeTruthy();
    expect(meta('meta[property="og:description"]')).toBeTruthy();
    expect(meta('meta[name="twitter:card"]')).toBe("summary_large_image");
  });

  it("aponta a imagem por endereço absoluto — caminhos relativos não funcionam", () => {
    ['meta[property="og:image"]', 'meta[name="twitter:image"]'].forEach((selector) => {
      expect(meta(selector)).toMatch(/^https:\/\//);
      expect(meta(selector)).toBe(`${SITE_URL}assets/og-image.jpg`);
    });
  });

  it("tem mesmo a imagem, com o tamanho que os cartões anunciam", () => {
    const image = resolve(root, "assets/og-image.jpg");
    expect(existsSync(image), "falta assets/og-image.jpg").toBe(true);

    const { width, height } = jpegSize(image);
    expect(width).toBe(Number(meta('meta[property="og:image:width"]')));
    expect(height).toBe(Number(meta('meta[property="og:image:height"]')));
    expect(width).toBe(1200);
    expect(height).toBe(630);
    // O WhatsApp ignora imagens demasiado pesadas.
    expect(statSync(image).size).toBeLessThan(300 * 1024);
  });

  it("publica as pastas de que a página inicial precisa", () => {
    const copied = workflow.match(/cp -R (.+) _site\//)[1].split(/\s+/);
    expect(copied).toContain("assets");
    expect(copied).toContain("puzzles");
  });
});

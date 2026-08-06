# Puzzles de aniversário

Um puzzle por pessoa, pensado primeiro para telemóvel e publicado através do GitHub Pages.
Cada pessoa tem o seu jogo: uns são puzzles deslizantes, outros são de encaixe (jigsaw).

A página inicial ([`index.html`](index.html)) é apenas um índice com as ligações para cada puzzle.

A pré-visualização das ligações (a imagem que o WhatsApp mostra) vive em
`assets/og-image.jpg` para a página inicial e em `assets/og-image.jpg` dentro da
pasta de cada pessoa. Os testes verificam que existem e que os cartões `og:`
apontam para elas por endereço absoluto.

## Estrutura

Cada puzzle vive numa pasta só sua — o nome da pasta é o nome da pessoa em minúsculas
e com hífen, porque é ele que aparece no endereço. Lá dentro está tudo o que a página
precisa: a própria página, as imagens e os testes.

```
puzzles/
└── ines-ferreira/
    ├── index.html               # a página, sem dependências: abre-se num browser
    ├── ines-ferreira.test.js    # todos os testes deste puzzle
    └── assets/
        ├── photo.jpg            # a fotografia que se transforma em puzzle (quadrada)
        ├── favicon.png          # o ícone do separador (64 × 64)
        └── og-image.jpg         # a pré-visualização das ligações (1200 × 630)
```

Nenhuma página vai buscar ficheiros fora da sua pasta, por isso os puzzles nunca
se estragam uns aos outros — e um teste de cada suite verifica exactamente isso.

## Puzzles

| Pessoa | Jogo | Página | Testes |
| --- | --- | --- | --- |
| Inês Ferreira | Deslizante 3 × 3 | [`puzzles/ines-ferreira/`](puzzles/ines-ferreira/index.html) | [`ines-ferreira.test.js`](puzzles/ines-ferreira/ines-ferreira.test.js) |
| Pedro Fernandes | Encaixe (jigsaw) 4 × 4 | [`puzzles/pedro-fernandes/`](puzzles/pedro-fernandes/index.html) | [`pedro-fernandes.test.js`](puzzles/pedro-fernandes/pedro-fernandes.test.js) |

## Acrescentar uma pessoa

1. Copiar a pasta do jogo que se quer: `cp -R puzzles/pedro-fernandes puzzles/maria-silva`
2. Substituir `assets/photo.jpg` (quadrada), `assets/favicon.png` e `assets/og-image.jpg`.
3. Em `index.html`, mudar a constante `PUZZLE` (nome e mensagem), os textos
   visíveis e os endereços `canonical` / `og:` para `.../puzzles/maria-silva/`.
4. Mudar o nome do ficheiro de testes para `maria-silva.test.js` e as constantes
   `PERSON` e `SLUG` no topo do ficheiro.
5. Acrescentar a pessoa à lista da página inicial e à tabela deste README.

No puzzle de encaixe, a dificuldade está na constante `SIZE` (4 = 16 peças).

## Testes

```bash
npm install
npm test          # corre os testes de todos os puzzles
npm run test:watch
```

Os testes correm as páginas a sério, num browser simulado ([jsdom](https://github.com/jsdom/jsdom)):
baralham as peças, jogam o puzzle até ao fim e confirmam que a festa final aparece com o
nome certo. Cada ficheiro de testes é autónomo — não importa nada de outro puzzle.

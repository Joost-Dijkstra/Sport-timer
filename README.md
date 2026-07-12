# Sporttimer Cool

![Sporttimer Cool Logo](./logo-sporttimer-cool.svg)

Een nauwkeurige, installeerbare sporttimer met een smartwatch-interface, offline ondersteuning, sterke alarmsignalen en verschillende thema's.

## Functies

- Deadline-gebaseerde timer die ook na browser- of schermvertraging correct blijft
- Presets voor twee sporttimers en een rusttimer
- Oranje/blauwe voortgangsring met glow-grens
- Acht alarmtonen, 1 tot 10 herhalingen, tempo, toonlengte en volume tot 150%
- Start-, pauze- en eindsprintfeedback
- Scherm wakker houden via de Screen Wake Lock API
- Thema's: Neon Race, Arctic Pulse en Lava Forge
- Instellingen worden lokaal bewaard
- Installeerbare PWA met offline ondersteuning
- Toegankelijke knoppen en instellingendialoog

## Lokaal starten

```powershell
python -m http.server 4173
```

Open daarna `http://localhost:4173/`.

## Tests

```powershell
npm test
```

## Bestanden

- `index.html`: hoofdapp en PWA-startpunt
- `styles.css`: gedeelde styling
- `timer-core.js`: testbare tijdsberekeningen
- `app.js`: timer, audio, instellingen en wake lock
- `service-worker.js`: offline cache en updates
- `index-basic.html`: bewaarde oudere basisversie
- `index-cool.html`: doorverwijzing naar de hoofdapp

## Live

[GitHub Pages](https://joost-dijkstra.github.io/Sport-timer/)

## Auteur

Gemaakt door Joost Dijkstra.

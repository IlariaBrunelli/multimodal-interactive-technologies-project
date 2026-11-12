# 🎓 Assistente multimodale per il campus – Multimodal Interactive Technologies Project

Progetto di gruppo per il corso di **Multimodal Interactive Technologies and Applications**, **Politecnico di Milano**.

Una **web app per smartphone** che aiuta gli studenti a orientarsi e a vivere il campus combinando più modalità di interazione: **realtà aumentata** con fotocamera e posizione, **chat con un assistente AI**, **voce** in ingresso e in uscita, mappe e calendario.

## Il problema

Il campus è grande e le informazioni utili sono sparse: dove si trova un'aula, dove trovare una fontanella, un microonde o una presa, cosa c'è in un certo edificio, quali lezioni ci sono oggi. L'obiettivo è riunire tutto in un'unica app, usabile in movimento, che lasci scegliere allo studente il modo di interagire più comodo in quel momento: guardare, scrivere o parlare.

## Funzionalità

- **Modalità AR**: inquadrando il campus con la fotocamera, l'app usa la posizione per mostrare gli edifici vicini (entro 160 metri) all'altezza giusta sullo schermo, con la distanza aggiornata in tempo reale. Toccando un edificio se ne leggono i dettagli storici. Se la realtà aumentata non è disponibile, si passa a una mappa OpenStreetMap.
- **Assistente AI in chat**: un assistente dedicato al campus, accessibile dopo il login, che conosce la posizione dell'utente e risponde alle domande sul Politecnico.
- **Interazione vocale**: riconoscimento vocale per scrivere in chat parlando e sintesi vocale per ascoltare le risposte, sia in chat sia in modalità AR.
- **Assistente calendario**: collegato al calendario dello studente, per consultare gli impegni della giornata.
- **Visita guidata**: un percorso a tappe che accompagna l'utente alla scoperta del campus.
- **Navigazione verso le aule**: indicazioni per raggiungere l'aula di destinazione.
- **Servizi del campus**: mappe dedicate a fontanelle, microonde, prese elettriche e punti ristoro.

L'interfaccia segue l'identità visiva del Politecnico, l'app si può installare sullo smartphone direttamente dal browser ed è stata rifinita in base ai risultati di una **valutazione euristica**.

## Architettura

| Livello | Tecnologie | Ruolo |
|---|---|---|
| Frontend | **Nuxt 4** (Vue), **TypeScript**, **Tailwind CSS** | Interfaccia mobile, modalità AR, voce, mappe |
| Backend | Server API di Nuxt | Chat, dati del campus, visita guidata, calendario |
| Dati e autenticazione | **Supabase** (login con sessioni JWT) | Utenti, edifici, servizi del campus |
| Assistente AI | **n8n** (in Docker, con PostgreSQL) | Flussi dell'assistente in chat e dati per la visita guidata |
| Mappe | **OpenStreetMap** | Mappa di riserva alla modalità AR |
| Esposizione | **Cloudflare Tunnel** | HTTPS, necessario per usare la fotocamera da smartphone |

## Installazione

La guida completa per installare e avviare l'app, configurare le variabili d'ambiente e gestire n8n (installazione, backup e ripristino dei workflow) è in **[SETUP.md](./SETUP.md)**.

## Il team

[Daniel Carrozzo](https://github.com/danielcarrozzo), [Drea2001](https://github.com/Drea2001), [fabio-vokrri](https://github.com/fabio-vokrri), **[Ilaria Brunelli](https://github.com/IlariaBrunelli)**.

## Fonte e licenza

Questo repository è un fork del repository del gruppo, [danielcarrozzo/mita_fadi](https://github.com/danielcarrozzo/mita_fadi), distribuito con licenza MIT (vedi [`LICENSE`](./LICENSE)).

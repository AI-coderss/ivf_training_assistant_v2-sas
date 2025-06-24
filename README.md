
#  🧬 IVF Virtual Training Assistant

A multi-page, full-stack AI-powered web application designed to support the virtual training of IVF doctors and fellows at **Doctor Samir Abbas Hospital**.

The platform combines speech-enabled chat, medical context understanding, educational content, summaries, quizzes, and a 3D avatar to deliver an engaging and intelligent training experience.
```mermaid
  
```

---

## 📌 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
  - [Backend Setup (Flask)](#1-backend-setup-flask)
  - [Frontend Setup (React)](#2-frontend-setup-react)
- [Environment Variables](#-environment-variables)
- [Routing (Pages)](#-routing-pages)
- [API Endpoints](#-api-endpoints)
- [Screenshots](#-screenshots)
- [Future Improvements](#-future-improvements)
- [License](#-license)
- [Contact](#-contact)

---

## 🎯 Features

- 💬 **AI Chat Assistant** powered by OpenAI for IVF-focused discussions
- 🎤 **Real-time Voice Recognition** via browser-native Web Speech API
- ✍️ **Free-text & voice input** via an elegant input widget
- 🧠 **Medical Prompt Engineering** from `backend/prompts/prompt.py`
- 🪟 **Glassmorphic UI Design** with blurred panels and hover effects
- 📖 **Summaries Page** for quick revision of key concepts
- 🧪 **Quizzes Page** (Multiple-choice) for self-evaluation
- 📚 **Content Page** with downloadable resources (videos, PDFs, etc.)
- 🧍 **Avatar Page** to interact with a 3D virtual AI guide
- 📱 **Fully Responsive** — supports tablets, desktops, and large phones
- 🔄 **Multi-page Navigation** with animated active link indicator
- 🪄 **Lottie Loader** animation during response generation

---

## 🧰 Tech Stack

| Layer        | Technologies                                                                 |
|--------------|-------------------------------------------------------------------------------|
| **Frontend** | React, React Router, CSS3, Lottie, Web Speech API, Material Icons            |
| **Backend**  | Python, Flask, OpenAI API, dotenv                                             |
| **AI Layer** | GPT-4o or gpt-3.5-turbo via `/generate` endpoint                             |
| **Audio**    | `react-media-recorder` for audio capture and conversion to byte stream       |
| **Design**   | Glassmorphism, mobile responsiveness, animated transitions                   |

---

## 🧾 Project Structure

```

IVF\_ASSISTANT/
│
├── backend/
│   ├── app.py                    # Flask server entrypoint
│   ├── requirements.txt
│   ├── prompts/
│   │   └── prompt.py             # Prompt template logic
│   └── .env                      # API key and config
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/           # ChatInputWidget, Navbar, etc.
│   │   ├── pages/                # Multi-page layout
│   │   │   ├── ChatPage.jsx
│   │   │   ├── QuizzesPage.jsx
│   │   │   ├── SummariesPage.jsx
│   │   │   ├── ContentPage.jsx
│   │   │   └── AvatarPage.jsx
│   │   ├── styles/              # Modular CSS for each component
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── README.md                # ← you're here

````

---

## 🛠 Installation & Setup

### 1. Backend Setup (Flask)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
````

#### Run the Flask server:

```bash
python app.py
```

> Default: `http://localhost:5000`

---

### 2. Frontend Setup (React)

```bash
cd frontend
npm install
npm start
```

> Runs on: `http://localhost:3000`

---

## 🔐 Environment Variables

### `.env` (Backend):

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Don't forget to add `.env` to your `.gitignore`.

---

## 🌍 Routing (Pages)

| Route        | File                | Purpose                           |
| ------------ | ------------------- | --------------------------------- |
| `/`          | `ChatPage.jsx`      | Main AI chat assistant            |
| `/quizzes`   | `QuizzesPage.jsx`   | Multiple-choice IVF quizzes       |
| `/summaries` | `SummariesPage.jsx` | Short explanations and key points |
| `/content`   | `ContentPage.jsx`   | Books, videos, articles           |
| `/avatar`    | `AvatarPage.jsx`    | 3D avatar conversation (coming)   |

---

## 🔌 API Endpoints

| Method | Endpoint        | Description                        |
| ------ | --------------- | ---------------------------------- |
| POST   | `/generate`     | Core endpoint for OpenAI GPT calls |
| POST   | `/audio` (opt.) | Accepts voice blob (if used)       |

> All AI messages are routed through `/generate`.

---

## 📸 Screenshots

> Add screenshots to `frontend/public/` and reference them here

```
📍 Chat Page
![Chat](./public/screenshots/chat.png)

📍 Avatar Page
![Avatar](./public/screenshots/avatar.png)
```

---

## 🔮 Future Enhancements

* ✅ Real-time audio transcription with Whisper API
* ✅ Persistent session history (save chats per doctor)
* ✅ Admin dashboard to manage training content
* ✅ Typing indicator for AI response
* ✅ Text-to-speech responses for hands-free mode
* ✅ PDF summary download per session
* ✅ Medical quiz scoring and progress tracker

---

## 📜 License

This project is licensed under the **MIT License**.
See [LICENSE](./LICENSE) for details.

---

## 🤝 Contributors

* **Mohammed** – AI Developer, Chat UI, Prompt Engineering
* **Dr. Samir Abbas Hospital** – Vision & Medical Supervision

---

## 📬 Contact

For questions, improvements, or demo requests:

📧 [Email](mohmmed.bahageel@dsah.sa)
💼 [LinkedIn Profile](https://www.linkedin.com/in/mohammed-bahageel-94609b205)
🌍 [Our Website](https://www.dsah.sa)






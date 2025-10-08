# 🧠 IAT • Teste de Associação Implícita

Sistema web para criação e execução de testes de associação implícita (IAT), permitindo avaliar associações automáticas entre marcas e valências (positiva/negativa).

---

## 🚀 Funcionalidades

- Cadastro de novos testes com duas marcas (imagens e nomes)
- Inserção de frases genéricas com valência positiva ou negativa
- Execução de testes com tutorial interativo
- Coleta automática de respostas e tempos de reação
- Armazenamento de execuções com CPF anonimizado (hash SHA-256)
- Resumo estatístico das respostas e tempos médios

---

## 🧩 Tecnologias utilizadas

- **Node.js + Express** — backend e API REST  
- **SQLite** — banco de dados local leve  
- **HTML, CSS e JavaScript puro** — frontend minimalista  
- **Fetch API** — comunicação com o backend  

---

## ⚙️ Como rodar o projeto

### 1. Clonar o repositório
``bash
git clone https://github.com/vitorfariaa/SinapSense_IAT.git
cd SinapSense_IAT

### 2. Instalar dependências
``bash
npm install

### 3. Rodar o projeto
``bash
node server.js

### 4. Acessar o navegador
``bash
http://localhost:3000

## 🧮 Endpoints principais da API

- GET	/api/tests	Lista todos os testes cadastrados
- POST	/api/tests	Cria um novo teste
- GET	/api/tests/:id	Retorna detalhes (marcas e frases) de um teste
- POST	/api/runs	Inicia uma execução (CPF, idade, gênero)
- POST	/api/runs/:id/trials	Salva as respostas de uma execução
- GET	/api/runs/:id/summary	Retorna o resumo estatístico de uma execução






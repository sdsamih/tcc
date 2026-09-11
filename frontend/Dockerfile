# Stage 1: Build do frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Build do frontend com variável de ambiente
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Stage 2: Servir com nginx
FROM nginx:alpine

# Copiar nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build do frontend para nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Expor porta 80
EXPOSE 80

# Iniciar nginx
CMD ["nginx", "-g", "daemon off;"]

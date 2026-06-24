FROM node:22-alpine AS build

WORKDIR /workspace/front
COPY front/package.json front/package-lock.json ./
RUN npm ci

COPY front ./
RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/front/dist /usr/share/nginx/html

EXPOSE 80

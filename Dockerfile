FROM node:9

WORKDIR /app

COPY package.json .
RUN npm install
RUN npm install --save amqplib

COPY . .

USER node
EXPOSE 8095

CMD ["npm", "start"]
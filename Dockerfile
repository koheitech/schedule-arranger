FROM --platform=linux/x86_64 node:16.14.2-slim

RUN apt-get update
RUN apt-get install -y locales git procps vim tmux curl
RUN locale-gen en_US.UTF-8
RUN localedef -f UTF-8 -i en_US en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV TZ=Asia/Tokyo
WORKDIR /app

FROM --platform=linux/x86_64 postgres:14.2
RUN apt-get update
RUN apt-get install -y curl
RUN locale-gen en_US.UTF-8
RUN localedef -f UTF-8 -i en_US en_US.UTF-8
USER postgres
ENV LANG=en_US.UTF-8
ENV TZ=Asia/Tokyo

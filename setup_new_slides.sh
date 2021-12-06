#!/bin/bash


if [ $# -ne 1 ]; then
    echo "Usage: $0 <slide-name>"
    exit 0
fi

slide_name=$1

mkdir -p slides/${slide_name}/images

cp ./index.html slides/${slide_name}/
for f in cursor.js main.js favicon.ico assets; do
    if [ ! -e slides/${slide_name}/${f} ]; then
        ln -s ../../${f} slides/${slide_name}/
    fi
done

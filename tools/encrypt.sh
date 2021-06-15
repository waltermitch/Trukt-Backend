openssl enc -e -aes-256-cbc -md sha512 -S $ENC_SALT -K $ENC_KEY -iv $ENC_IV -in $1 -out $2

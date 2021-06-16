CONTACT_EMAIL='vklimkiv@rcglogistics.com'

if [[ -z $ENC_SALT ]] || [[ -z $ENC_KEY ]] || [[ -z $ENC_IV ]]; then
    echo "ERROR:"
    echo "ENC_SALT, ENC_KEY, ENC_IV environment vars not set."
    echo "Contact $CONTACT_EMAIL"
    exit 1
else
    openssl enc -e -aes-256-cbc -md sha512 -S $ENC_SALT -K $ENC_KEY -iv $ENC_IV -in $1 -out $2
fi

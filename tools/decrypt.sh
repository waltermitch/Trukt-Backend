CONTACT_EMAIL='vklimkiv@rcglogistics.com'

if [[ -f ./secrets/encrypt_keys ]]; then
    set -o allexport && . ./secrets/encrypt_keys && set +o allexport
else
    echo "No secrets folder found"
fi

if [[ -z $ENC_SALT ]] || [[ -z $ENC_KEY ]] || [[ -z $ENC_IV ]]; then
    echo "ERROR:"
    echo "ENC_SALT, ENC_KEY, ENC_IV environment vars not set."
    echo -e "\033[0;31mERROR: Contact $CONTACT_EMAIL"
    exit 1
else
    openssl enc -d -aes-256-cbc -md sha512 -S $ENC_SALT -K $ENC_KEY -iv $ENC_IV -in $1 -out $2
    echo "Decrypted $1 to $2"
fi

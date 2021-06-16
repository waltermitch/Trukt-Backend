ENVVAR='DEBUG=knex*'

if [[ $1 == "off" ]]; then
    echo 'DEBUG MODE OFF'
    ENVVAR="DEBUG=''"
else
    echo 'DEBUG MODE ON'
fi

export $ENVVAR

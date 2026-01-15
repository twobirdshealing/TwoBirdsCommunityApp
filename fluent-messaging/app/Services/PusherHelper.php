<?php

namespace FluentMessaging\App\Services;


class PusherHelper
{

    public static function sendMessage($channel, $event, $data)
    {
        $puser = self::getPusher();
        if ($puser) {
            return $puser->trigger($channel, $event, $data);
        }
    }

    public static function getPusher()
    {

        if (!defined('FLUENT_MESSAGING_PUSHER_APP_CLUSTER')) {
            return null;
        }

        $options = array(
            'cluster' => FLUENT_MESSAGING_PUSHER_APP_CLUSTER,
            'useTLS'  => true
        );

        return new \Pusher\Pusher(
            FLUENT_MESSAGING_PUSHER_APP_KEY,
            FLUENT_MESSAGING_PUSHER_APP_SECRET,
            FLUENT_MESSAGING_PUSHER_APP_ID,
            $options
        );
    }

}

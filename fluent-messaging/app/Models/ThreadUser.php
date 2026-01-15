<?php

namespace FluentMessaging\App\Models;

use FluentCommunity\App\Models\XProfile;

class ThreadUser extends Model
{
    protected $table = 'fcom_chat_thread_users';

    protected $fillable = [
        'thread_id',
        'user_id',
        'status',
        'last_seen_message_id'
    ];

    public function thread()
    {
        return $this->belongsTo(Thread::class, 'thread_id');
    }

    public function xprofile()
    {
        return $this->belongsTo(XProfile::class, 'user_id');
    }

    public function email_notification_pref()
    {
        return $this->hasOne('FluentCommunity\App\Models\NotificationSubscription', 'user_id', 'user_id')
            ->where('notification_type', 'message_email_frequency');
    }
}

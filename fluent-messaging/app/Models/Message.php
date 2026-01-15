<?php

namespace FluentMessaging\App\Models;


use FluentCommunity\App\Models\User;
use FluentCommunity\App\Models\XProfile;

class Message extends Model
{
    protected $table = 'fcom_chat_messages';

    protected $fillable = [
        'thread_id',
        'user_id',
        'text',
        'meta'
    ];

    public static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->user_id)) {
                $model->user_id = get_current_user_id();
            }

            global $wpdb;
            $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}fcom_chat_threads SET message_count = message_count + 1, updated_at = %s WHERE id = %d", current_time('mysql'), $model->thread_id));
        });
    }

    public function setMetaAttribute($meta)
    {
        $originalMeta = $this->getOriginal('meta');

        $originalMeta = \maybe_unserialize($originalMeta);

        foreach ($meta as $key => $value) {
            $originalMeta[$key] = $value;
        }

        $this->attributes['meta'] = \maybe_serialize($originalMeta);
    }

    public function getMetaAttribute($meta)
    {
        return \maybe_unserialize($meta);
    }

    public function thread()
    {
        return $this->belongsTo(Thread::class, 'thread_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'ID');
    }

    public function xprofile()
    {
        return $this->belongsTo(XProfile::class, 'user_id', 'user_id');
    }
}

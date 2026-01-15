<?php

namespace FluentMessaging\App\Models;

use FluentCommunity\App\Models\Media;
use FluentCommunity\App\Models\BaseSpace;
use FluentCommunity\App\Models\User;
use FluentCommunity\App\Models\XProfile;

class Thread extends Model
{
    protected $table = 'fcom_chat_threads';

    protected $fillable = [
        'title',
        'space_id',
        'status',
        'message_count'
    ];

    public function messages()
    {
        return $this->hasMany(Message::class, 'thread_id');
    }

    public function space()
    {
        return $this->belongsTo(BaseSpace::class, 'space_id');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'fcom_chat_thread_users', 'thread_id', 'user_id')
            ->withPivot('status', 'last_seen_message_id')
            ->withTimestamps();
    }

    public function xprofiles()
    {
        return $this->belongsToMany(XProfile::class, 'fcom_chat_thread_users', 'thread_id', 'user_id', 'id', 'user_id')
            ->withPivot('status', 'last_seen_message_id')
            ->withTimestamps();
    }

    public function getOtherUser($currentUserId)
    {
        return $this->users()->where('user_id', '!=', $currentUserId)->first();
    }

    public function getOtherProfile($currentUserId)
    {
        return $this->xprofiles()->getQuery()->where('fcom_xprofile.user_id', '!=', $currentUserId)->first();
    }

    public function thread_users()
    {
        return $this->hasMany(ThreadUser::class, 'thread_id', 'id');
    }

    public function deleteChatThread()
    {
        // Let's delete all the messages
        Message::where('thread_id', $this->id)->delete();
        ThreadUser::where('thread_id', $this->id)->delete();
        Media::where('object_source', 'chat_message')->where('feed_id', $this->id)
            ->update([
                'is_active' => 0
            ]);
        $this->delete();
    }
}

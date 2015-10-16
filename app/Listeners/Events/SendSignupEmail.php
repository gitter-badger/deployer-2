<?php

namespace REBELinBLUE\Deployer\Listeners\Events;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Message;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Lang;
use Illuminate\Support\Facades\Mail;
use REBELinBLUE\Deployer\Events\UserWasCreated;

/**
 * Sends an email when the user has been created.
 */
class SendSignupEmail extends Event implements ShouldQueue
{
    use InteractsWithQueue;

    /**
     * Create the event handler.
     *
     * @return SendSignupEmail
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     *
     * @param  UserWasCreated $event
     * @return void
     */
    public function handle(UserWasCreated $event)
    {
        $user = $event->user;

        $data = [
            'password' => $event->password,
            'email'    => $user->email,
        ];

        Mail::queueOn(
            'deployer-low',
            'emails.account',
            $data,
            function (Message $message) use ($user) {
                $message->to($user->email, $user->name)
                        ->subject(Lang::get('emails.creation_subject'));
            }
        );
    }
}

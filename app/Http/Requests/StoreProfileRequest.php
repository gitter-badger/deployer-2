<?php

namespace REBELinBLUE\Deployer\Http\Requests;

use Illuminate\Support\Facades\Input;
use REBELinBLUE\Deployer\Http\Requests\Request;

/**
 * Validate the user name and password.
 */
class StoreProfileRequest extends Request
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        $rules = [
            'name'     => 'required|max:255',
            'password' => 'required|confirmed|min:6',
        ];

        if (Input::get('password') === '') {
            unset($rules['password']);
        }

        return $rules;
    }
}

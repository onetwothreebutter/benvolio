module Main exposing (main)

import Navigation
import Json.Encode
import Model exposing (..)
import Update exposing (..)
import View exposing (..)
import Subscriptions exposing (..)


main : Program Never Model Msg
main =
    Navigation.program UrlChange
        { view = View.view
        , update = Update.update
        , init = init
        , subscriptions = Subscriptions.subscriptions
        }


init : Navigation.Location -> ( Model, Cmd Msg )
init location =
    let
        maybeFirebaseKey =
            parseLocation location

        fetchModelUsingFirebaseKey =
            case maybeFirebaseKey of
                Just key ->
                    getConversationFromFirebase (Json.Encode.string key)

                Nothing ->
                    Cmd.none
    in
        ( initialModel
        , fetchModelUsingFirebaseKey
        )

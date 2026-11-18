module Subscriptions exposing (..)

import Model exposing (..)
import Update exposing (..)


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ getFirebaseKey GetFirebaseKey
        , sendConversationIntoElm (decodeConversationIntoElm >> LoadConversation)
        ]

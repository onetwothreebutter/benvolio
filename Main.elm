module Main exposing (main)

import Benvolio
import Html


main : Program Never Benvolio.Model Benvolio.Msg
main =
    Html.program
        { view = Benvolio.view
        , update = Benvolio.update
        , init = Benvolio.init
        , subscriptions = Benvolio.subscriptions
        }

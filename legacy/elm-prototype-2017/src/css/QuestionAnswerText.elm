module QuestionAnswerText exposing (..)

import Css exposing (..)
import Css.Elements exposing (body, li)
import Css.Namespace exposing (namespace)
import Css.Colors exposing (..)


type CssClasses
    = QuestionAnswerSet
    | Question
    | Answer


css =
    (stylesheet << namespace "benvolio-")
        [ class QuestionAnswerSet
            [ marginBottom (px 20)
            ]
        , class Question
            []
        , class Answer
            [ marginLeft (px 30)
            ]
        ]

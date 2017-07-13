module MyCss exposing (..)

import Css exposing (..)
import Css.Elements exposing (body, li)
import Css.Namespace exposing (namespace)
import Css.Colors exposing (..)
import Model exposing (..)


type CssClasses
    = ConversationContainer
    | BackNextButtonGroup
    | BackNextButton
    | CurrentStep
    | SectionHeading
    | IntroSentence
    | Topic
    | SideOfConversation
    | Initiator
    | Partner
    | InputText
    | QuestionInput
    | Question
    | QuestionLabel
    | PassToOtherPerson
    | PassToOtherPersonSender
    | QuestionsSection


type CssIds
    = Page


css =
    (stylesheet << namespace "benvolio-")
        [ class ConversationContainer
            [ maxWidth (px 700)
            , fontSize (px 18)
            ]
        , class BackNextButtonGroup
            [ marginTop (px 30)
            ]
        , class BackNextButton
            [ padding2
                (px 10)
                (px 20)
            , marginRight
                (px 20)
            , fontSize (px 14)
            , hover ([ cursor pointer ])
            ]
        , class CurrentStep
            [ marginTop (px 20)
            , fontSize (px 15)
            ]
        , class SectionHeading
            [ marginBottom (px 30)
            , fontSize (px 32)
            ]
        , class IntroSentence
            [ marginBottom (px 20)
            ]
        , class Topic
            [ fontSize (px 20)
            , marginBottom (px 20)
            ]
        , class SideOfConversation
            [ sideOfConversation
            ]
        , class Initiator
            [ borderColor green
            , backgroundColor (rgb 245 255 250)
            ]
        , class Partner
            [ borderColor (hex "2b98e2")
            , backgroundColor (rgb 240 248 255)
            ]
        , class InputText
            [ inputTextStyle
            ]
        , class Question
            [ margin4 (px 0) (px 0) (px 20) (px 0)
            ]
        , class QuestionLabel
            []
        , class QuestionInput
            [ inputTextStyle
            ]
        , class PassToOtherPerson
            [ display inlineBlock
            , backgroundColor
                (rgba 255 220 0 0.11)
            , padding
                (px 10)
            ]
        , class PassToOtherPersonSender
            [ marginBottom (px 20)
            ]
        , class QuestionsSection
            [ marginBottom (px 30)
            ]
        ]


inputTextStyle =
    batch
        [ display
            block
        , maxWidth
            (px 700)
        , width
            (px 700)
        , padding2
            (px 5)
            (px 10)
        , fontSize (px 15)
        , marginBottom (px 13)
        ]


sideOfConversation =
    batch
        [ padding (px 10)
        , backgroundColor (rgb 245 255 250)
        , border3 (px 1) solid green
        , borderRadius (px 10)
        , marginBottom (px 30)
        , maxWidth (px 600)
        ]



-- alicebliue and #2b98e2

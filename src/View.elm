module View exposing (..)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (..)
import Model exposing (..)
import Update exposing (..)


view : Model -> Html Msg
view model =
    case model.step of
        1 ->
            div []
                [ label [] [ text ("Hi! What topic would you like to discuss?") ]
                , input [ onInput ConversationTopic, value model.topic ] []
                , viewNextBackButtons model.step
                ]

        2 ->
            div []
                [ label [] [ text "What's your name?" ]
                , Html.map InitiatorUpdate (viewPersonName model.initiator)
                , div []
                    [ label [] [ text "And what's your gender?" ]
                    , Html.map InitiatorUpdate (viewPersonGender model.initiator)
                    , viewNextBackButtons model.step
                    ]
                ]

        3 ->
            div []
                [ label [] [ text ("With who would you like to discuss \"" ++ model.topic ++ "\"?") ]
                , div [] [ Html.map PartnerUpdate (viewPersonName model.partner) ]
                , div []
                    [ text "And what's this person's gender?"
                    , Html.map PartnerUpdate (viewPersonGender model.partner)
                    ]
                , viewNextBackButtons model.step
                ]

        4 ->
            div []
                [ div []
                    [ text
                        ("You want to talk with "
                            ++ model.partner.name
                            ++ " about \""
                            ++ model.topic
                            ++ "\"."
                        )
                    ]
                , label [] [ text ("What is your position on \"" ++ model.topic ++ "\"?") ]
                , Html.map InitiatorUpdate (viewPersonStance model.initiator)
                , viewNextBackButtons model.step
                ]

        5 ->
            div []
                [ div []
                    [ text
                        ("You want to talk with "
                            ++ model.partner.name
                            ++ " about \""
                            ++ model.topic
                            ++ "\" and your stance is \""
                            ++ model.initiator.sideOfConversation.stance
                            ++ "\"."
                        )
                    ]
                , label [] [ text ("List 3 reasons why you hold your stance.") ]
                , div []
                    [ label [] [ text "Reason 1:" ]
                    , Html.map InitiatorUpdate (viewPersonReason1 model.initiator)
                    ]
                , div []
                    [ label [] [ text "Reason 2:" ]
                    , Html.map InitiatorUpdate (viewPersonReason2 model.initiator)
                    ]
                , div []
                    [ label [] [ text "Reason 3:" ]
                    , Html.map InitiatorUpdate (viewPersonReason3 model.initiator)
                    ]
                , viewNextBackButtons model.step
                ]

        6 ->
            div []
                [ div []
                    [ text
                        ("To summarize, you want to talk with "
                            ++ model.partner.name
                            ++ " about \""
                            ++ model.topic
                            ++ "\". You think \""
                            ++ model.initiator.sideOfConversation.stance
                            ++ "\" because : "
                        )
                    ]
                , viewListOfReasons
                    [ model.initiator.sideOfConversation.reason1
                    , model.initiator.sideOfConversation.reason2
                    , model.initiator.sideOfConversation.reason3
                    ]
                , div []
                    [ text ("Hand this over to " ++ model.partner.name ++ " if you're ready for " ++ (herHim model.partner.gender) ++ " to enter " ++ (herHis model.partner.gender) ++ " stance and reasons.")
                    ]
                , viewNextBackButtons model.step
                ]

        7 ->
            div []
                [ text (model.partner.name ++ ", " ++ model.initiator.name ++ " would like to talk with you about \"" ++ model.topic ++ "\". [show initiator stance here?]")
                , div []
                    [ label [] [ text ("What's your stance on \"" ++ model.topic ++ "\"?") ]
                    , Html.map PartnerUpdate (viewPersonStance model.partner)
                    , viewNextBackButtons model.step
                    ]
                ]

        8 ->
            div []
                [ text
                    ("Your stance on \""
                        ++ model.topic
                        ++ "\" is \""
                        ++ model.partner.sideOfConversation.stance
                        ++ "\"."
                    )
                , div []
                    [ label [] [ text ("List 3 reasons why you hold your stance.") ]
                    , div []
                        [ label [] [ text "Reason 1:" ]
                        , Html.map PartnerUpdate (viewPersonReason1 model.partner)
                        ]
                    , div []
                        [ label [] [ text "Reason 2:" ]
                        , Html.map PartnerUpdate (viewPersonReason2 model.partner)
                        ]
                    , div []
                        [ label [] [ text "Reason 3:" ]
                        , Html.map PartnerUpdate (viewPersonReason3 model.partner)
                        ]
                    ]
                , viewNextBackButtons model.step
                ]

        9 ->
            div []
                [ text
                    ("You're talking about \""
                        ++ model.topic
                        ++ "\" with \""
                        ++ model.initiator.name
                        ++ "\". You think \""
                        ++ model.partner.sideOfConversation.stance
                        ++ "\" because :"
                    )
                , viewListOfReasons
                    [ model.partner.sideOfConversation.reason1
                    , model.partner.sideOfConversation.reason2
                    , model.partner.sideOfConversation.reason3
                    ]
                , div []
                    [ text
                        ("If the above is correct, hand this to "
                            ++ model.initiator.name
                            ++ " so "
                            ++ (sheHe model.initiator.gender)
                            ++ " can see your stance and reasons and answer another question."
                        )
                    ]
                , viewNextBackButtons model.step
                ]

        10 ->
            div []
                [ text
                    ("Hi, "
                        ++ model.initiator.name
                        ++ "! Below you will see "
                        ++ model.partner.name
                        ++ "'s stance, and "
                        ++ (herHis model.partner.gender)
                        ++ " reasons why "
                        ++ (sheHe model.partner.gender)
                        ++ " holds that stance."
                    )
                , div []
                    [ viewStanceSummary model.partner
                    , viewReasonsSummary model.partner
                    ]
                , viewNextBackButtons model.step
                ]

        11 ->
            div []
                [ text
                    ("Hi, "
                        ++ model.initiator.name
                        ++ "! Below you will see "
                        ++ model.partner.name
                        ++ "'s stance on \""
                        ++ model.topic
                        ++ "\", and "
                        ++ (herHis model.partner.gender)
                        ++ " reasons why "
                        ++ (sheHe model.partner.gender)
                        ++ " holds that stance."
                    )
                , div []
                    [ viewStanceSummary model.partner
                    , viewReasonsSummary model.partner
                    ]
                , text
                    ("Why do you think "
                        ++ model.partner.name
                        ++ " listed these reasons? Try to be empathetic and don't say things liKe \"Because "
                        ++ model.partner.name
                        ++ " is an idiot\"."
                    )
                , div []
                    [ Html.map InitiatorUpdate (viewPersonEmpathy1 model.initiator)
                    ]
                , div []
                    [ Html.map InitiatorUpdate (viewPersonEmpathy2 model.initiator)
                    ]
                , div []
                    [ Html.map InitiatorUpdate (viewPersonEmpathy3 model.initiator)
                    ]
                , viewNextBackButtons model.step
                ]

        12 ->
            div []
                [ text
                    ("Here is a summary of why you think "
                        ++ model.partner.name
                        ++ " listed "
                        ++ (herHis model.partner.gender)
                        ++ " reasons for "
                        ++ (herHis model.partner.gender)
                        ++ " stance of \""
                        ++ model.partner.sideOfConversation.stance
                        ++ "\"."
                    )
                , div []
                    [ viewEmpathySummary model Initiator False
                    ]
                , text
                    ("If this looks okay, hand this over to "
                        ++ model.partner.name
                        ++ " so "
                        ++ (sheHe model.partner.gender)
                        ++ " can empathize about your reasons."
                    )
                , viewNextBackButtons model.step
                ]

        13 ->
            div []
                [ text
                    ("Hi "
                        ++ model.partner.name
                        ++ "! Below are the reasons "
                        ++ model.initiator.name
                        ++ " listed for "
                        ++ (herHis model.initiator.gender)
                        ++ " stance on \""
                        ++ model.topic
                        ++ "\"."
                    )
                , div []
                    [ viewStanceSummary model.initiator
                    , viewReasonsSummary model.initiator
                    ]
                , viewNextBackButtons model.step
                ]

        14 ->
            div []
                [ text
                    ("Hi "
                        ++ model.partner.name
                        ++ "! Below are the reasons "
                        ++ model.initiator.name
                        ++ " listed for "
                        ++ (herHis model.initiator.gender)
                        ++ " stance on \""
                        ++ model.topic
                        ++ "\"."
                    )
                , div []
                    [ viewStanceSummary model.initiator
                    , viewReasonsSummary model.initiator
                    ]
                , text
                    ("Why do you think "
                        ++ model.initiator.name
                        ++ " listed these reasons?  Try to be empathetic and don't say things liKe \"Because "
                        ++ model.initiator.name
                        ++ " is an idiot\"."
                    )
                , div []
                    [ Html.map PartnerUpdate (viewPersonEmpathy1 model.partner)
                    ]
                , div []
                    [ Html.map PartnerUpdate (viewPersonEmpathy2 model.partner)
                    ]
                , div []
                    [ Html.map PartnerUpdate (viewPersonEmpathy3 model.partner)
                    ]
                , viewNextBackButtons model.step
                ]

        15 ->
            div []
                [ text ("Here is a summary of your empathy for " ++ model.initiator.name ++ "'s reasons: ")
                , viewEmpathySummary model Partner False
                , text ("Click \"next\" to see " ++ model.initiator.name ++ "'s empathy for your reasons.")
                , viewNextBackButtons model.step
                ]

        16 ->
            div []
                [ text ("Below is " ++ model.initiator.name ++ "'s empathy for your reasons.")
                , viewEmpathySummary model Initiator False
                , viewNextBackButtons model.step
                ]

        17 ->
            div []
                [ text
                    ("When you're done, pass this back to "
                        ++ model.initiator.name
                        ++ " so "
                        ++ sheHe model.initiator.gender
                        ++ " can see your empathy."
                    )
                , viewNextBackButtons model.step
                ]

        18 ->
            div []
                [ text ("Hi " ++ model.initiator.name ++ "! Below is " ++ model.partner.name ++ "'s empathy for your reasons.")
                , viewEmpathySummary model Partner False
                , viewNextBackButtons model.step
                ]

        19 ->
            div []
                [ text ("You can stop here and view a final summary together, or you can proceed to the next phase where you pose questions to each other to further increase understanding.")
                , br [] []
                , br [] []
                , div []
                    [ div [] [ text ("Topic: " ++ model.topic) ]
                    , viewStanceSummary model.initiator
                    , viewReasonsSummary model.initiator
                    , viewEmpathySummary model Initiator True
                    ]
                , br [] []
                , div []
                    [ viewStanceSummary model.partner
                    , viewReasonsSummary model.partner
                    , viewEmpathySummary model Partner True
                    ]
                , viewNextBackButtons model.step
                ]

        20 ->
            div []
                []

        _ ->
            div []
                [ text "undefined step"
                , viewNextBackButtons model.step
                ]


viewPersonName : Person -> Html PersonMsg
viewPersonName person =
    input [ onInput NameUpdate, value person.name ] []


viewPersonGender : Person -> Html PersonMsg
viewPersonGender person =
    div []
        [ label []
            [ input [ type_ "radio", checked (person.gender == Male), onClick (GenderUpdate Male) ] []
            , text "Male"
            ]
        , label []
            [ input [ type_ "radio", checked (person.gender == Female), onClick (GenderUpdate Female) ] []
            , text "Female"
            ]
        , label []
            [ input [ type_ "radio", checked (person.gender == Trans), onClick (GenderUpdate Trans) ] []
            , text "Trans"
            ]
        ]


viewPersonStance : Person -> Html PersonMsg
viewPersonStance person =
    Html.map ConversationUpdate (input [ onInput Stance, value person.sideOfConversation.stance, size 100 ] [])


viewPersonReason1 : Person -> Html PersonMsg
viewPersonReason1 person =
    Html.map ConversationUpdate (input [ onInput Reason1, value person.sideOfConversation.reason1, size 100 ] [])


viewPersonReason2 : Person -> Html PersonMsg
viewPersonReason2 person =
    Html.map ConversationUpdate (input [ onInput Reason2, value person.sideOfConversation.reason2, size 100 ] [])


viewPersonReason3 : Person -> Html PersonMsg
viewPersonReason3 person =
    Html.map ConversationUpdate (input [ onInput Reason3, value person.sideOfConversation.reason3, size 100 ] [])


viewPersonEmpathy1 : Person -> Html PersonMsg
viewPersonEmpathy1 person =
    Html.map ConversationUpdate (input [ onInput Empathy1, value person.sideOfConversation.empathy1, size 100 ] [])


viewPersonEmpathy2 : Person -> Html PersonMsg
viewPersonEmpathy2 person =
    Html.map ConversationUpdate (input [ onInput Empathy2, value person.sideOfConversation.empathy2, size 100 ] [])


viewPersonEmpathy3 : Person -> Html PersonMsg
viewPersonEmpathy3 person =
    Html.map ConversationUpdate (input [ onInput Empathy3, value person.sideOfConversation.empathy3, size 100 ] [])


viewStanceSummary : Person -> Html msg
viewStanceSummary person =
    if person.sideOfConversation.stance /= "" then
        text (person.name ++ "'s stance is \"" ++ person.sideOfConversation.stance ++ "\"")
    else
        text ""


viewReasonsSummary : Person -> Html msg
viewReasonsSummary person =
    if person.sideOfConversation.reason1 /= "" then
        div []
            [ text ("Reasons " ++ person.name ++ " holds this stance are: ")
            , ul []
                [ li [] [ text person.sideOfConversation.reason1 ]
                , li [] [ text person.sideOfConversation.reason2 ]
                , li [] [ text person.sideOfConversation.reason3 ]
                ]
            ]
    else
        text ""


viewEmpathySummary : Model -> ConversationRole -> Bool -> Html msg
viewEmpathySummary model role labelOn =
    let
        empathizer =
            if role == Initiator then
                model.initiator
            else
                model.partner

        empathizee =
            if role == Initiator then
                model.partner
            else
                model.initiator

        label =
            if labelOn then
                text (empathizer.name ++ "'s empathy for " ++ empathizee.name ++ "'s reasons:")
            else
                text ""
    in
        if empathizer.sideOfConversation.empathy1 /= "" then
            div []
                [ label
                , ul []
                    [ li [] [ text (empathizee.name ++ ": " ++ empathizee.sideOfConversation.reason1) ]
                    , li [] [ text (empathizer.name ++ ": " ++ empathizer.sideOfConversation.empathy1) ]
                    , br [] []
                    , li [] [ text (empathizee.name ++ ": " ++ empathizee.sideOfConversation.reason2) ]
                    , li [] [ text (empathizer.name ++ ": " ++ empathizer.sideOfConversation.empathy2) ]
                    , br [] []
                    , li [] [ text (empathizee.name ++ ": " ++ empathizee.sideOfConversation.reason3) ]
                    , li [] [ text (empathizer.name ++ ": " ++ empathizer.sideOfConversation.empathy3) ]
                    ]
                ]
        else
            text ""


sheHe : Gender -> String
sheHe gender =
    case gender of
        Female ->
            "she"

        Male ->
            "he"

        Trans ->
            "ze"


herHis : Gender -> String
herHis gender =
    case gender of
        Female ->
            "her"

        Male ->
            "his"

        Trans ->
            "zer"


herHim : Gender -> String
herHim gender =
    case gender of
        Female ->
            "her"

        Male ->
            "him"

        Trans ->
            "zer"


viewListOfReasons : List String -> Html msg
viewListOfReasons reasons =
    ol []
        (List.map text reasons
            |> List.map (\item -> [ item ])
            |> List.map (li [])
        )


viewNextBackButtons : Int -> Html Msg
viewNextBackButtons currentStep =
    if currentStep > 1 then
        div []
            [ button [ onClick (SetStep (currentStep - 1)) ] [ text "Back" ]
            , button [ onClick (SetStep (currentStep + 1)) ] [ text "Next" ]
            , div []
                [ text ("current step: " ++ (toString currentStep))
                ]
            ]
    else
        div []
            [ button [ onClick (SetStep (currentStep + 1)) ] [ text "Next" ]
            ]



--
--
-- viewParticipantSummary : Model -> Html msg
-- viewParticipantSummary model =
--     div []
--         [ div []
--             [ label []
--                 [ text "Stance:"
--                 ]
--             , div []
--                 [ text model.stance
--                 ]
--             ]
--         ]

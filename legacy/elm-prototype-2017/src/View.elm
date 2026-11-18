module View exposing (..)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (..)
import String exposing (..)
import Char exposing (..)
import Model exposing (..)
import Update exposing (..)
import Html.CssHelpers exposing (..)
import MyCss
import QuestionAnswerText


{ id, class, classList } =
    Html.CssHelpers.withNamespace "benvolio-"


view : Model -> Html Msg
view model =
    div [ class [ MyCss.ConversationContainer ] ]
        [ viewStep model
        , viewNextBackButtons model.step
        ]


viewStep : Model -> Html Msg
viewStep model =
    case model.step of
        1 ->
            div []
                [ div []
                    [ text
                        ("Hi! Benvolio is a website that helps two people understand each other better. ")
                    ]
                , label [] [ text ("What topic would you like to discuss?") ]
                , input [ onInput ConversationTopic, value model.topic, class [ MyCss.InputText ] ] []
                ]

        2 ->
            div []
                [ label [] [ text "What's your first name?" ]
                , Html.map InitiatorUpdate (viewPersonName model.initiator)
                , div []
                    [ label [] [ text "And what's your gender?" ]
                    , Html.map InitiatorUpdate (viewPersonGender model.initiator)
                    ]
                ]

        3 ->
            div []
                [ label [] [ text ("And what's the first name of the person with whom you would like to discuss \"" ++ model.topic ++ "\"?") ]
                , div [] [ Html.map PartnerUpdate (viewPersonName model.partner) ]
                , div []
                    [ text "And what's this person's gender?"
                    , Html.map PartnerUpdate (viewPersonGender model.partner)
                    ]
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
                            ++ "\" because: "
                        )
                    ]
                , viewListOfReasons
                    [ model.initiator.sideOfConversation.reason1
                    , model.initiator.sideOfConversation.reason2
                    , model.initiator.sideOfConversation.reason3
                    ]
                , instructionsForTransferToOtherPerson model.initiator model.partner
                ]

        7 ->
            div []
                [ text
                    (model.partner.name
                        ++ ", "
                        ++ model.initiator.name
                        ++ " would like to talk with you about \""
                        ++ model.topic
                        ++ "\". "
                        ++ (sheHe model.initiator.gender |> capitalize)
                        ++ " thinks \""
                        ++ model.initiator.sideOfConversation.stance
                        ++ "\"."
                    )
                , div []
                    [ label [] [ text ("What's your stance on \"" ++ model.topic ++ "\"?") ]
                    , Html.map PartnerUpdate (viewPersonStance model.partner)
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
                ]

        9 ->
            div []
                [ text
                    ("You're talking about \""
                        ++ model.topic
                        ++ "\" with "
                        ++ model.initiator.name
                        ++ ". You think \""
                        ++ model.partner.sideOfConversation.stance
                        ++ "\" because :"
                    )
                , viewListOfReasons
                    [ model.partner.sideOfConversation.reason1
                    , model.partner.sideOfConversation.reason2
                    , model.partner.sideOfConversation.reason3
                    ]
                , instructionsForTransferToOtherPerson model.partner model.initiator
                ]

        10 ->
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
                        ++ " listed these reasons? Be empathetic and make a genuine effort to understand "
                        ++ (herHis model.partner.gender)
                        ++ " viewpoint. Try not to say things like \"Because "
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
                , div [ class [ MyCss.PassToOtherPerson, MyCss.PassToOtherPersonSender ] ]
                    [ text
                        ("If this looks okay, hit \"Next\" and hand or send this over to "
                            ++ model.partner.name
                            ++ " so "
                            ++ (sheHe model.partner.gender)
                            ++ " can empathize with your reasons."
                        )
                    ]
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
                        ++ " listed these reasons?  Try to be empathetic and make a genuine effort to undertand "
                        ++ (herHis model.initiator.gender)
                        ++ " viewpoint. Don't say things like \""
                        ++ model.initiator.name
                        ++ " thinks that because "
                        ++ (sheHe model.initiator.gender)
                        ++ "'s an idiot.\""
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
                ]

        15 ->
            div []
                [ text ("Here is a summary of your empathy for " ++ model.initiator.name ++ "'s reasons: ")
                , viewEmpathySummary model Partner False
                , text ("Click \"Next\" to see " ++ model.initiator.name ++ "'s empathy for your reasons.")
                ]

        16 ->
            div []
                [ text ("Below is " ++ model.initiator.name ++ "'s empathy for your reasons.")
                , viewEmpathySummary model Initiator False
                ]

        17 ->
            div []
                [ instructionsForTransferToOtherPerson model.partner model.initiator
                ]

        18 ->
            div []
                [ text ("Hi " ++ model.initiator.name ++ "! Below is " ++ model.partner.name ++ "'s empathy for your reasons.")
                , viewEmpathySummary model Partner False
                ]

        19 ->
            div []
                [ div [ class [ MyCss.IntroSentence ] ]
                    [ text ("You can stop here and view a final summary together, or you can proceed to the next phase where you pose questions to each other to further increase understanding.")
                    ]
                , div [ class [ MyCss.Topic ] ] [ text ("Topic: " ++ model.topic) ]
                , viewFirstConversationSummary model
                ]

        20 ->
            div []
                [ viewQuestionsPlusText model.initiator model.partner
                ]

        21 ->
            div []
                [ viewQuestionsSummaryBeforeSend model.initiator model.partner
                ]

        22 ->
            div []
                [ viewReceiverAnswersQuestions model.initiator model.partner
                ]

        23 ->
            div []
                [ viewQuestionsPlusText model.partner model.initiator
                ]

        24 ->
            div []
                [ viewQuestionsSummaryBeforeSend model.partner model.initiator
                ]

        25 ->
            div []
                [ viewReceiverAnswersQuestions model.partner model.initiator
                ]

        26 ->
            div []
                [ text
                    (model.initiator.name
                        ++ ", here are your answers to "
                        ++ model.partner.name
                        ++ "'s questions."
                    )
                , viewQuestionsAndAnswers model.partner model.initiator
                , instructionsForTransferToOtherPerson model.initiator model.partner
                ]

        27 ->
            div []
                [ text
                    (model.partner.name
                        ++ ", here are "
                        ++ model.initiator.name
                        ++ "'s answers to your questions."
                    )
                , viewQuestionsAndAnswers model.partner model.initiator
                , div [ class [ MyCss.PassToOtherPerson ] ] [ text "Click 'Next' to view a summary of the Question and Answer Section" ]
                ]

        28 ->
            div []
                [ div [ class [ MyCss.SectionHeading ] ]
                    [ text ("Question and Answer Section summary")
                    ]
                , div [ class [ MyCss.Topic ] ] [ text ("Topic: " ++ model.topic) ]
                , viewQuestionSectionSummary model
                , instructionsForTransferToOtherPerson model.partner model.initiator
                ]

        29 ->
            div []
                [ text "The end"
                ]

        _ ->
            div []
                [ text "undefined step"
                ]


viewPersonName : Person -> Html PersonMsg
viewPersonName person =
    input [ onInput NameUpdate, value person.name, class [ MyCss.InputText ] ] []


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
    Html.map ConversationUpdate (input [ onInput Stance, value person.sideOfConversation.stance, class [ MyCss.InputText ] ] [])


viewPersonReason1 : Person -> Html PersonMsg
viewPersonReason1 person =
    Html.map ConversationUpdate (input [ onInput Reason1, value person.sideOfConversation.reason1, class [ MyCss.InputText ] ] [])


viewPersonReason2 : Person -> Html PersonMsg
viewPersonReason2 person =
    Html.map ConversationUpdate (input [ onInput Reason2, value person.sideOfConversation.reason2, class [ MyCss.InputText ] ] [])


viewPersonReason3 : Person -> Html PersonMsg
viewPersonReason3 person =
    Html.map ConversationUpdate (input [ onInput Reason3, value person.sideOfConversation.reason3, class [ MyCss.InputText ] ] [])


viewPersonEmpathy1 : Person -> Html PersonMsg
viewPersonEmpathy1 person =
    Html.map ConversationUpdate (input [ onInput Empathy1, value person.sideOfConversation.empathy1, class [ MyCss.InputText ] ] [])


viewPersonEmpathy2 : Person -> Html PersonMsg
viewPersonEmpathy2 person =
    Html.map ConversationUpdate (input [ onInput Empathy2, value person.sideOfConversation.empathy2, class [ MyCss.InputText ] ] [])


viewPersonEmpathy3 : Person -> Html PersonMsg
viewPersonEmpathy3 person =
    Html.map ConversationUpdate (input [ onInput Empathy3, value person.sideOfConversation.empathy3, class [ MyCss.InputText ] ] [])


viewPersonQuestion1 : Person -> Html PersonMsg
viewPersonQuestion1 person =
    Html.map ConversationUpdate (input [ onInput Question1, value person.sideOfConversation.question1, size 100, class [ MyCss.QuestionInput ] ] [])


viewPersonQuestion2 : Person -> Html PersonMsg
viewPersonQuestion2 person =
    Html.map ConversationUpdate (input [ onInput Question2, value person.sideOfConversation.question2, size 100, class [ MyCss.QuestionInput ] ] [])


viewPersonQuestion3 : Person -> Html PersonMsg
viewPersonQuestion3 person =
    Html.map ConversationUpdate (input [ onInput Question3, value person.sideOfConversation.question3, size 100, class [ MyCss.QuestionInput ] ] [])


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
            div []
                [ text "No empathy entered"
                ]


viewFirstConversationSummary : Model -> Html msg
viewFirstConversationSummary model =
    div []
        [ div [ class [ MyCss.SideOfConversation, MyCss.Initiator ] ]
            [ viewStanceSummary model.initiator
            , viewReasonsSummary model.initiator
            , viewEmpathySummary model Initiator True
            ]
        , div [ class [ MyCss.SideOfConversation, MyCss.Partner ] ]
            [ viewStanceSummary model.partner
            , viewReasonsSummary model.partner
            , viewEmpathySummary model Partner True
            ]
        ]


viewQuestionsPlusText : Person -> Person -> Html Msg
viewQuestionsPlusText questionAsker questionAnswerer =
    let
        personUpdateMsg =
            if questionAsker.role == Initiator then
                InitiatorUpdate
            else
                PartnerUpdate
    in
        div []
            [ div [ class [ MyCss.QuestionsSection ] ]
                [ text
                    ("In this section, you can ask "
                        ++ questionAnswerer.name
                        ++ " three questions about "
                        ++ (herHis questionAnswerer.gender)
                        ++ " stance, reasons, or empathy, or anything eles you think will help you understand "
                        ++ (herHim questionAnswerer.gender)
                        ++ " or help "
                        ++ (herHim questionAnswerer.gender)
                        ++ " understand you. Don't ask qustions like \"Were you dropped on your head as a baby?\""
                    )
                ]
            , div [ class [ "questions-prompt" ] ]
                [ text ("What are three questions you have for " ++ questionAnswerer.name ++ "?")
                ]
            , div []
                [ Html.map personUpdateMsg (viewPersonQuestion1 questionAsker)
                , Html.map personUpdateMsg (viewPersonQuestion2 questionAsker)
                , Html.map personUpdateMsg (viewPersonQuestion3 questionAsker)
                ]
            ]


viewQuestionsSummaryBeforeSend : Person -> Person -> Html Msg
viewQuestionsSummaryBeforeSend sender receiver =
    div []
        [ text ("Here are the questions you're going to send to " ++ (receiver.name) ++ ":")
        , viewQuestionsSummary sender.sideOfConversation
        , instructionsForTransferToOtherPerson sender receiver
        ]


viewReceiverAnswersQuestions : Person -> Person -> Html Msg
viewReceiverAnswersQuestions sender receiver =
    let
        updateMsg =
            if receiver.role == Initiator then
                InitiatorUpdate
            else
                PartnerUpdate
    in
        div []
            [ text
                ("Hi, "
                    ++ receiver.name
                    ++ "! "
                    ++ sender.name
                    ++ " has written 3 questions "
                    ++ sheHe sender.gender
                    ++ " would like you to answer. Hopefully these questions will increase understanding between you and "
                    ++ sender.name
                    ++ "."
                )
            , div
                []
                [ Html.map updateMsg (viewQuestionsReadyToAnswer sender.sideOfConversation receiver.sideOfConversation)
                ]
            ]


viewQuestionsAndAnswers : Person -> Person -> Html msg
viewQuestionsAndAnswers asker answerer =
    div []
        [ ul []
            [ li [ class [ QuestionAnswerText.QuestionAnswerSet ] ]
                [ span [ class [ QuestionAnswerText.Question ] ]
                    [ text asker.sideOfConversation.question1
                    ]
                , li [ class [ QuestionAnswerText.Answer ] ]
                    [ text answerer.sideOfConversation.answer1
                    ]
                ]
            , li [ class [ QuestionAnswerText.QuestionAnswerSet ] ]
                [ span [ class [ QuestionAnswerText.Question ] ]
                    [ text asker.sideOfConversation.question2
                    ]
                , li [ class [ QuestionAnswerText.Answer ] ]
                    [ text answerer.sideOfConversation.answer2
                    ]
                ]
            , li [ class [ QuestionAnswerText.QuestionAnswerSet ] ]
                [ span [ class [ QuestionAnswerText.Question ] ]
                    [ text asker.sideOfConversation.question3
                    ]
                , li [ class [ QuestionAnswerText.Answer ] ]
                    [ text answerer.sideOfConversation.answer3
                    ]
                ]
            ]
        ]


viewQuestionsAndAnswersWithCaption : Person -> Person -> Html msg
viewQuestionsAndAnswersWithCaption asker answerer =
    div []
        [ text (asker.name ++ "'s questions and " ++ answerer.name ++ "'s answers")
        , viewQuestionsAndAnswers asker answerer
        ]


viewQuestionsSummary : SideOfConversation -> Html msg
viewQuestionsSummary sideOfConv =
    if sideOfConv.question1 /= "" then
        div []
            [ ul []
                [ li [] [ text sideOfConv.question1 ]
                , li [] [ text sideOfConv.question2 ]
                , li [] [ text sideOfConv.question3 ]
                ]
            ]
    else
        text ""


viewQuestionsReadyToAnswer : SideOfConversation -> SideOfConversation -> Html PersonMsg
viewQuestionsReadyToAnswer sideOfConv1 sideOfConv2 =
    Html.map ConversationUpdate
        (ul []
            [ li [ class [ MyCss.Question ] ]
                [ label [ class [ "question__label" ] ] [ text sideOfConv1.question1 ]
                , input [ onInput Answer1, value sideOfConv2.answer1, class [ MyCss.QuestionInput ] ] []
                ]
            , li [ class [ MyCss.Question ] ]
                [ label [ class [ "question__label" ] ] [ text sideOfConv1.question2 ]
                , input [ onInput Answer2, value sideOfConv2.answer2, class [ MyCss.QuestionInput ] ] []
                ]
            , li [ class [ MyCss.Question ] ]
                [ label [ class [ "question__label" ] ] [ text sideOfConv1.question3 ]
                , input [ onInput Answer3, value sideOfConv2.answer3, class [ MyCss.QuestionInput ] ] []
                ]
            ]
        )


viewQuestionSectionSummary : Model -> Html msg
viewQuestionSectionSummary model =
    div []
        [ div [ class [ MyCss.SideOfConversation, MyCss.Initiator ] ]
            [ viewStanceSummary model.initiator
            , viewReasonsSummary model.initiator
            , viewQuestionsAndAnswersWithCaption model.initiator model.partner
            ]
        , div [ class [ MyCss.SideOfConversation, MyCss.Partner ] ]
            [ viewStanceSummary model.partner
            , viewReasonsSummary model.partner
            , viewQuestionsAndAnswersWithCaption model.partner model.initiator
            ]
        ]


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


capitalize : String -> String
capitalize str =
    case (uncons str) of
        Just ( char, str2 ) ->
            cons (Char.toUpper char) str2

        Nothing ->
            ""


instructionsForTransferToOtherPerson : Person -> Person -> Html msg
instructionsForTransferToOtherPerson sender receiver =
    div []
        [ div [ class [ MyCss.PassToOtherPerson, MyCss.PassToOtherPersonSender ] ]
            [ text
                (sender.name
                    ++ ": Pass this device to "
                    ++ receiver.name
                    ++ " or send "
                    ++ herHim receiver.gender
                    ++ " the link in the address bar above. Don't hit the 'Back' or 'Next' button after sending the link."
                )
            ]
        , div [ class [ MyCss.PassToOtherPerson ] ]
            [ text
                (receiver.name
                    ++ ": Go ahead and press the 'Next' button."
                )
            ]
        ]


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
        div [ class [ MyCss.BackNextButtonGroup ] ]
            [ button [ onClick (SetStep (currentStep - 1)), class [ MyCss.BackNextButton ] ] [ text "Back" ]
            , button [ onClick (SetStep (currentStep + 1)), class [ MyCss.BackNextButton ] ] [ text "Next" ]
            , div [ class [ MyCss.CurrentStep ] ]
                [ text ("current step: " ++ (toString currentStep))
                ]
            ]
    else
        div []
            [ button [ onClick (SetStep (currentStep + 1)), class [ MyCss.BackNextButton ] ] [ text "Next" ]
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

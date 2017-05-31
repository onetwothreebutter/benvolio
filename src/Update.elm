port module Update exposing (..)

import Model exposing (..)
import Json.Encode exposing (..)
import Json.Decode exposing (..)
import Json.Decode.Pipeline exposing (..)
import Navigation exposing (..)
import UrlParser exposing (..)


type Msg
    = SetStep Int
    | ConversationTopic String
    | InitiatorUpdate PersonMsg
    | PartnerUpdate PersonMsg
    | UrlChange Navigation.Location
    | GetFirebaseKey String
    | LoadConversation (Result String Model)


type PersonMsg
    = NameUpdate String
    | GenderUpdate Gender
    | ConversationUpdate SideOfConversationMsg


type SideOfConversationMsg
    = Stance String
    | Reason1 String
    | Reason2 String
    | Reason3 String
    | Empathy1 String
    | Empathy2 String
    | Empathy3 String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        SetStep newStep ->
            let
                modelAsValue =
                    modelToValue { model | step = newStep }

                cmdToRun =
                    saveConversation modelAsValue
            in
                ( { model | step = newStep }, cmdToRun )

        ConversationTopic newTopic ->
            ( { model | topic = newTopic, partner = model.partner }, Cmd.none )

        InitiatorUpdate personMsg ->
            ( { model | initiator = updatePerson personMsg model.initiator }, Cmd.none )

        PartnerUpdate personMsg ->
            ( { model | partner = updatePerson personMsg model.partner }, Cmd.none )

        UrlChange location ->
            let
                location2 =
                    Debug.log "location" location

                parsedUrl =
                    parseLocation location
            in
                ( model, Cmd.none )

        GetFirebaseKey key ->
            ( { model | firebaseKey = key }, Navigation.modifyUrl key )

        LoadConversation modelResult ->
            case modelResult of
                Ok modelFromFirebase ->
                    ( modelFromFirebase, Cmd.none )

                Err errorMessage ->
                    let
                        blackhold =
                            Debug.log errorMessage
                    in
                        ( model, Cmd.none )



-- TODO output error message


getPersonToUpdate : ConversationRole -> Model -> Person
getPersonToUpdate role model =
    case role of
        Initiator ->
            model.initiator

        Partner ->
            model.partner


updatePerson : PersonMsg -> Person -> Person
updatePerson personMsg person =
    case personMsg of
        NameUpdate newName ->
            { person | name = newName }

        GenderUpdate newGender ->
            { person | gender = newGender }

        ConversationUpdate conversationMsg ->
            { person | sideOfConversation = (updateSideOfConversation conversationMsg person.sideOfConversation) }


updateSideOfConversation : SideOfConversationMsg -> SideOfConversation -> SideOfConversation
updateSideOfConversation conversationMsg conversation =
    case conversationMsg of
        Stance newStance ->
            { conversation | stance = newStance }

        Reason1 newReason1 ->
            { conversation | reason1 = newReason1 }

        Reason2 newReason2 ->
            { conversation | reason2 = newReason2 }

        Reason3 newReason3 ->
            { conversation | reason3 = newReason3 }

        Empathy1 newEmpathy1 ->
            { conversation | empathy1 = newEmpathy1 }

        Empathy2 newEmpathy2 ->
            { conversation | empathy2 = newEmpathy2 }

        Empathy3 newEmpathy3 ->
            { conversation | empathy3 = newEmpathy3 }


port saveConversation : Json.Encode.Value -> Cmd msg


port getFirebaseKey : (String -> msg) -> Sub msg


port getConversationFromFirebase : Json.Encode.Value -> Cmd msg


port sendConversationIntoElm : (Json.Decode.Value -> msg) -> Sub msg


modelToValue : Model -> Json.Encode.Value
modelToValue model =
    Json.Encode.object
        [ ( "firebaseKey", Json.Encode.string model.firebaseKey )
        , ( "step", Json.Encode.int model.step )
        , ( "topic", Json.Encode.string model.topic )
        , ( "initiator", personToValue model.initiator )
        , ( "partner", personToValue model.partner )
        ]


personToValue : Person -> Json.Encode.Value
personToValue person =
    Json.Encode.object
        [ ( "role", roleToValue person.role )
        , ( "name", Json.Encode.string person.name )
        , ( "gender", genderToValue person.gender )
        , ( "sideOfConversation", sideOfConvToValue person.sideOfConversation )
        ]


roleToValue : ConversationRole -> Json.Encode.Value
roleToValue role =
    case role of
        Initiator ->
            Json.Encode.string "Initiator"

        Partner ->
            Json.Encode.string "Partner"


genderToValue : Gender -> Json.Encode.Value
genderToValue gender =
    case gender of
        Male ->
            Json.Encode.string "Male"

        Female ->
            Json.Encode.string "Female"

        Trans ->
            Json.Encode.string "Trans"


sideOfConvToValue : SideOfConversation -> Json.Encode.Value
sideOfConvToValue sideOfConv =
    Json.Encode.object
        [ ( "stance", Json.Encode.string sideOfConv.stance )
        , ( "reason1", Json.Encode.string sideOfConv.reason1 )
        , ( "reason2", Json.Encode.string sideOfConv.reason2 )
        , ( "reason3", Json.Encode.string sideOfConv.reason3 )
        , ( "empathy1", Json.Encode.string sideOfConv.empathy1 )
        , ( "empathy2", Json.Encode.string sideOfConv.empathy2 )
        , ( "empathy3", Json.Encode.string sideOfConv.empathy3 )
        ]


decodeConversationIntoElm : Json.Decode.Value -> Result String Model
decodeConversationIntoElm =
    Json.Decode.decodeValue modelDecoder


modelDecoder : Json.Decode.Decoder Model
modelDecoder =
    decode Model
        |> required "firebaseKey" Json.Decode.string
        |> required "step" Json.Decode.int
        |> required "topic" Json.Decode.string
        |> required "initiator" personDecoder
        |> required "partner" personDecoder


personDecoder : Json.Decode.Decoder Person
personDecoder =
    decode Person
        |> required "role"
            (Json.Decode.string
                |> andThen roleDecoder
            )
        |> required "name" Json.Decode.string
        |> required "gender"
            (Json.Decode.string
                |> andThen genderDecoder
            )
        |> required "sideOfConversation" sideOfConvDecoder


roleDecoder : String -> Json.Decode.Decoder ConversationRole
roleDecoder role =
    case role of
        "Initiator" ->
            Json.Decode.succeed Initiator

        "Partner" ->
            Json.Decode.succeed Partner

        _ ->
            Json.Decode.fail (role ++ " is not recognized for ConversationRole")


genderDecoder : String -> Json.Decode.Decoder Gender
genderDecoder gender =
    case gender of
        "Male" ->
            Json.Decode.succeed Male

        "Female" ->
            Json.Decode.succeed Female

        "Trans" ->
            Json.Decode.succeed Trans

        _ ->
            Json.Decode.fail (gender ++ " is not recognized for Gender")


sideOfConvDecoder : Json.Decode.Decoder SideOfConversation
sideOfConvDecoder =
    decode SideOfConversation
        |> required "stance" Json.Decode.string
        |> required "reason1" Json.Decode.string
        |> required "reason2" Json.Decode.string
        |> required "reason3" Json.Decode.string
        |> required "empathy1" Json.Decode.string
        |> required "empathy2" Json.Decode.string
        |> required "empathy3" Json.Decode.string


parseLocation : Location -> Maybe String
parseLocation location =
    parsePath UrlParser.string location

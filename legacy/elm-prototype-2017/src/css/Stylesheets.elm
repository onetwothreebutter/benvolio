port module Stylesheets exposing (..)

import Css.File exposing (CssFileStructure, CssCompilerProgram)
import MyCss
import QuestionAnswerText


port files : CssFileStructure -> Cmd msg


fileStructure : CssFileStructure
fileStructure =
    Css.File.toFileStructure
        [ ( "index.css", Css.File.compile [ MyCss.css, QuestionAnswerText.css ] ) ]


main : CssCompilerProgram
main =
    Css.File.compiler files fileStructure

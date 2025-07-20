import React from "react";
import PdfFlipBookDesktop from "./PdfFlipBookDesktop";
import PdfFlipBookMobile from "./PdfFlipBookMobile";

export default function PdfFlipBook(props) {
  const isMobile = window.innerWidth <= 1024;
  return isMobile ? (
    <PdfFlipBookMobile {...props} />
  ) : (
    <PdfFlipBookDesktop {...props} />
  );
}

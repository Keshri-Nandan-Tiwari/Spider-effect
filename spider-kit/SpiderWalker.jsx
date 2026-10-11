"use client"; // needed for Next.js app router; ignored elsewhere
import { useEffect } from "react";
import mountSpider from "./spider.js";

// Drop <SpiderWalker /> once, anywhere (e.g. in App.jsx). It renders nothing itself.
// Props are the mountSpider options, e.g. <SpiderWalker defaults={{ palette: "cyan" }} />
export default function SpiderWalker(props) {
  useEffect(() => {
    const spider = mountSpider(props);
    return () => spider.destroy();
    // mounted once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

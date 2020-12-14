import fetch from 'isomorphic-unfetch';
import { JSDOM } from 'jsdom';
import { DevpostHackathon, DevpostProject } from "../interfaces";

/**
 * Parses out the Devpost username from a given devpost profile url
 * @param devpostUrl Link to users devpost profile
 */
export const getUsernameFromUrl = (devpostUrl: string) => {
  try {
    const url = new URL(devpostUrl);
    if (url.hostname !== "devpost.com")
      return "";
    const pathname = url.pathname.length <= 0 ? "" : url.pathname.substring(1);
    const [username,] = pathname.split("/");
    return username;
  } catch (e) {
    console.error(e);
    return "";
  }
}

/**
 * Returns a list of hackathon projects a user has created 
 * @param devpostUsername Devpost user's username
 */
export const getUsersProjects = async (devpostUsername: string) => {
  const res = await fetch(`https://devpost.com/${devpostUsername}`);
  const projectPage = await res.text();

  const { document } = new JSDOM(projectPage).window;

  const projects: DevpostProject[] = [];
  document.querySelectorAll(".link-to-software").forEach(entry => {
    const projectTitle = entry.querySelector("h5").innerHTML.trim().replace(/^\s|\n/g, "");
    const projectLink = entry.attributes.getNamedItem("href").value;
    const numLikes = entry.querySelector("span.like-count").textContent.trim().replace(/^\s|\n/g, "");
    projects.push({
      title: projectTitle,
      link: projectLink,
      numLikes
    });
  });

  return projects;
}

/**
 * Returns the hackathon a given user has signed up for
 * @param devpostUsername Devpost user's username
 */
export const getUsersHackathons = async (devpostUsername: string) => {
  const res = await fetch(`https://devpost.com/${devpostUsername}/challenges`);
  const hackathonPage = await res.text();

  const { document } = new JSDOM(hackathonPage).window;

  // arrays containing the ids of the hackathons the user won or submitted to
  let hackathonsSubmitted = [];
  let hackathonsWon = []

  // apparently the badge indicating if the user submitted a project and won is not SSR'd
  // it ends up being in a script tag, so this parses it out
  document.querySelectorAll("#body-portfolios > script[charset=utf-8]").forEach(scriptTag => {
    if (scriptTag.innerHTML.includes("new CP.Home.ChallengeBadges(")) {
      try {
        const listings = JSON.parse("[" + scriptTag.innerHTML.split("new CP.Home.ChallengeBadges(")[1].split(")")[0] + "]");
        console.log(listings)
        hackathonsSubmitted = listings[0];
        hackathonsWon = listings[1];
      } catch (e) {
        console.error(e);
      }
    }
  });

  const hackathons: DevpostHackathon[] = [];
  document.querySelectorAll(".challenge-listing").forEach(entry => {
    const hackathonTitle = entry.querySelector("h2").textContent.trim();
    const hackathonLink = entry.querySelector("a").href;
    const devpostId = entry.attributes.getNamedItem("data-id").value;

    const hackathonThumbnail = (() => {
      let url = entry.querySelector(".thumbnail_image").attributes.getNamedItem("src").value;
      if (!url) return "";
      // append protocol if the url doesn't have it
      if (url.substring(0, 2) === "//") {
        url = "https:" + url;
      }

      try {
        const urlObject = new URL(url);
        // try to replace the "medium" size version of the image with the large one 
        if (urlObject.hostname === "challengepost-s3-challengepost.netdna-ssl.com" && urlObject.pathname.indexOf("datas/medium") > 0) {
          const fileIndex = urlObject.pathname.indexOf("/datas/medium");
          return urlObject.protocol + "//" + urlObject.hostname + urlObject.pathname.substring(0, fileIndex) + "/datas/large" + urlObject.pathname.substring(fileIndex + 13);
        } else {
          return url;
        }
      } catch (e) {
        // fallback and return original url if the URL parser fails
        return url;
      }
    })();

    const hackathonUrl = new URL(hackathonLink);

    const userWonPrize = hackathonsWon.includes(parseInt(devpostId || "0", 10));
    const userSubmittedProject = userWonPrize || hackathonsSubmitted.includes(parseInt(devpostId || "0", 10));

    hackathons.push({
      id: hackathonUrl.hostname, // hostname should be unique for each devpost hackathon
      title: hackathonTitle,
      link: hackathonLink,
      badgeImage: hackathonThumbnail,
      userSubmittedProject,
      userWonPrize
    });
  });

  return hackathons;
}
import mongoose from "mongoose";
import "dotenv/config";
import { faker } from "@faker-js/faker";

import Post from "../models/Post.js";
import User from "../models/User.js";
import connectDB from "../configs/db.js";

// ---------------- CONFIG ----------------
const REELS_PER_USER = 3;
const BATCH_SIZE = 1000;

// 🚀 Disable auto indexing for speed
mongoose.set("autoIndex", false);

const REEL_VIDEOS = [
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649996/12860836_3840_2160_30fps_g4mty0.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649806/14832112_1440_2560_30fps_any5zj.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649804/18211069-uhd_2160_3840_30fps_xknkdn.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649801/14864495_1080_1920_25fps_werjmq.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649801/14935338_2160_3840_30fps_hs7d4k.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649798/6825862-uhd_2160_3840_25fps_nikh4f.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649797/13203211_2160_3840_60fps_arimqc.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649790/14681001_1080_1920_30fps_uygeld.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649788/13919572_2160_3840_24fps_fujmv1.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649787/15616072_1080_1920_30fps_q0viff.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649775/14890800_2160_3840_30fps_ck9bck.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649775/15604872_1920_1080_24fps_mweqt3.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649770/15616072_1080_1920_30fps_1_ntwaiu.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649768/20523188-hd_1920_1080_25fps_o2kqm8.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649766/15562058_2160_3840_30fps_utorje.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649743/15558695_1080_1920_30fps_vrgyvb.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649737/15517392_1920_1080_60fps_lngvgu.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649735/15570687_1920_1080_25fps_taevfg.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649735/8659385-hd_1920_1080_30fps_jigdbb.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649731/15576387_2160_3840_30fps_1_dldpd1.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649726/7657447-hd_1080_1920_25fps_wlagex.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649719/15576386_2160_3840_30fps_nhi4tf.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649711/14924092_2160_3840_30fps_vipxx9.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649712/15577587_1080_1920_30fps_ioflko.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649708/15181830_1080_1920_30fps_rhaphg.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649705/15184861_1080_1920_30fps_oxa46i.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649691/15527253_1080_1920_30fps_zqereg.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649687/7690131-hd_1080_1920_30fps_lrbb5y.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649681/7198950-hd_720_1280_25fps_n0zti4.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649677/15453605_1080_1920_30fps_njqicu.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649676/15450331_1080_1920_100fps_z2bqg3.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649655/13777273_1080_1920_30fps_bzpype.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649654/15245934_1080_1920_30fps_r1vldz.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649649/13089013_1080_1920_60fps_fbbsm5.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649611/8020165-uhd_2160_3840_25fps_k6rkac.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649605/14818884_1080_1920_30fps_kuybpz.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649598/7235157-hd_1080_1920_30fps_qgvx8s.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649593/7746539-hd_1080_1920_30fps_uh8cgv.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649584/5149331-hd_1080_1896_25fps_g5xesf.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649554/13139547_2160_3840_30fps_gbf9ib.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649549/14858294_1080_1920_30fps_oxa7yn.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649545/14790533_1080_1920_30fps_ymojss.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649540/6666361-uhd_2160_3744_30fps_dxkkha.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649534/13244096_1080_1920_30fps_i0yajw.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649533/8439814-hd_1080_1920_25fps_id7osz.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649530/14766104_1080_1920_30fps_db2hxi.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649521/13142225_1080_1920_60fps_ndzacp.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649520/5767870-hd_1080_1920_25fps_uzvjkf.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649518/11898603_1080_1920_30fps_phxf5a.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649511/12024515_1080_1920_30fps_xuiidh.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649508/5667418-hd_1080_1920_24fps_s6amd1.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649811/9909326-uhd_2160_4096_25fps_hh8yny.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649811/8243988-uhd_2160_4096_25fps_zjc7hq.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649815/14867899_2160_3840_60fps_jvvmaa.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649816/5762143-uhd_2160_3840_24fps_kiwypd.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649819/15075356_2160_3840_60fps_elmo87.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649821/14962201_2160_3840_30fps_z1fsys.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649831/15075895_2160_3840_60fps_ira685.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649839/3894718-uhd_2160_4096_25fps_xslrkv.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649838/15443888_1080_1920_100fps_g55ag9.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649834/14776389_2160_3840_30fps_frohjg.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649834/20117683-uhd_2160_3840_60fps_fv6mfx.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649842/15328714_3840_2160_25fps_kn1n3v.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649864/13103067_2160_3840_30fps_g7jt5s.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649846/15479649_1440_2560_60fps_r3ctfl.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649876/14629508_2160_3840_30fps_ixpmek.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649882/15449137_3840_2160_60fps_jghqdx.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649884/13608365_1080_1920_30fps_ypum0p.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649885/15449901_2160_3840_60fps_a3lxrd.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649887/15617516_3840_2160_25fps_isxl0w.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649887/15615639_3840_2160_60fps_fibstd.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649889/5979940-uhd_2160_4096_24fps_amr8nq.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649898/12025285_3840_2160_30fps_pdfhe7.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649913/10640360-uhd_2160_4096_25fps_qwmtuw.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649933/15478211_2160_3840_30fps_h9oszl.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649935/6698947-uhd_2160_3840_25fps_toyo4o.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649937/4156321-uhd_2160_4096_25fps_i0kf0h.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649939/12867852_2160_3840_30fps_fu0ppg.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649957/15464699_2160_3840_30fps_dls5bt.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649956/15510985_2160_3840_30fps_ojlhur.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649959/15475219_2160_3840_30fps_ms99vo.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649966/14686959_2160_3840_30fps_yt8wvi.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649962/14631730_2160_3840_60fps_fmvdqk.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649967/14127273_3840_2160_60fps_lvdggv.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649969/15455565_3840_2160_60fps_fywbhp.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649976/15614001_3840_2160_30fps_qg6bew.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649971/12791704_2160_3840_30fps_rvo1tj.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649981/14767145_2160_3840_30fps_ajirzj.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649991/15445277_2160_3840_60fps_vitnop.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649993/12964965_2160_3840_50fps_b4qluk.mp4",
  "https://res.cloudinary.com/dhru8aro2/video/upload/v1775649996/12860836_3840_2160_30fps_g4mty0.mp4",
];

// ---------------- HELPERS ----------------
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const insertInBatches = async (Model, data) => {
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    await Model.insertMany(batch, { ordered: false });
  }
};

// ---------------- MAIN ----------------
const seedReels = async () => {
  await connectDB();
  console.log("✅ DB Connected");

  // ❗ Delete only reels
  await Post.deleteMany({ is_reel: true });
  console.log("🧹 Old reels deleted");

  // ---------------- USERS ----------------
  console.log("👤 Fetching users...");
  const users = await User.find({}, "_id");

  if (!users.length) {
    console.log("❌ No users found.");
    process.exit();
  }

  console.log("Users found:", users.length);

  // ---------------- DATA ----------------
  const categories = ["tech", "fun", "travel", "food", "fitness"];
  const audiences = ["students", "developers", "creators"];

  const captions = [
  "This is insane 🔥",
  "Wait for it 😳",
  "Travel vibes 🌍",
  "Late night thoughts 🌙",
  "Can't believe this 😂",
  "Just another day ✨",
  "POV: you needed this today 👀",
  "No way this just happened 🤯",
  "Mood right now 💭",
  "Living for moments like this 💫",
  "Tell me you saw that 😭",
  "Straight out of a movie 🎬",
  "This hits different 💔",
  "Small moments, big memories 🫶",
  "Why is this so satisfying 😌",
  "You won’t expect the ending 👇",
  "Just vibing 🎧",
  "This made my day 🥹",
  "Proof that magic exists ✨",
  "Watch till the end 👀"
];

  let reels = [];

  // ---------------- CREATE ----------------
  console.log("🎬 Creating reels...");

  for (const user of users) {
    for (let i = 0; i < REELS_PER_USER; i++) {
      reels.push({
        user: user._id,

        content: "",
        caption: randomItem(captions),

        // ✅ FIXED HERE
        media_url: randomItem(REEL_VIDEOS),

        thumbnail_url: faker.image.urlPicsumPhotos(),

        media_type: "video",
        post_type: "reel",
        is_reel: true,

        duration_seconds: faker.number.int({ min: 5, max: 45 }),

        // 🔥 Make feed realistic
        likes_count: faker.number.int({ min: 10, max: 5000 }),
        view_count: faker.number.int({ min: 100, max: 50000 }),
        shares_count: faker.number.int({ min: 0, max: 500 }),
        saves_count: faker.number.int({ min: 0, max: 500 }),

        // 🎯 Discovery
        category: randomItem(categories),
        sub_category: "general",
        target_audience: randomItem(audiences),
        visibility: "public",

        // 🔥 Make timestamps realistic
        createdAt: faker.date.recent({ days: 30 }),
        updatedAt: new Date(),
      });
    }
  }

  // ---------------- INSERT ----------------
  await insertInBatches(Post, reels);

  console.log("🎉 Reels created:", reels.length);

  process.exit();
};

// ---------------- RUN ----------------
seedReels();
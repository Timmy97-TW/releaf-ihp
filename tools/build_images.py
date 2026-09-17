#!/usr/bin/env python3
"""Scale the human-practices photos for the web. Scaled and re-encoded only;
no crop, colour or content edit. Source: wiki/human-practices/Pictures /"""
import subprocess, pathlib, sys
SRC = pathlib.Path(__file__).resolve().parents[2] / "wiki/human-practices"
P = SRC / "Pictures "
OUT = pathlib.Path(__file__).resolve().parents[1] / "assets/img/human-practices"
OUT.mkdir(parents=True, exist_ok=True)
M = {
 # expert meetings
 "Expert Engagement/meeting photo/3_19 Dr. Lin(1).png": "exp-0319-lin",
 "Expert Engagement/meeting photo/3_19 Dr. Lin": "exp-0319-lin-b",
 "Expert Engagement/meeting photo/4_10 Prof. Chen": "exp-0410-chen",
 "Expert Engagement/meeting photo/4_10 Prof. Chen(1).png": "exp-0410-chen-b",
 "Expert Engagement/meeting photo/4_18 Dr. Brophy.png": "exp-0418-brophy",
 "Expert Engagement/meeting photo/5_22 World Vegetable Center.png": "exp-0522-worldveg",
 "Expert Engagement/meeting photo/6_27 Dr. Sattely.png": "exp-0627-sattely",
 "Expert Engagement/meeting photo/7_28 黃介辰教授.png": "exp-0728-huang",
 "Expert Engagement/meeting photo/9_12 Dr. Sattley and Prof. Endy": "exp-0912-sattely-endy",
 "Expert Engagement/Interviewee photo/0414 Green Media 綠媒體 LOGO(透明底).png": "logo-greenmedia",
 # farmers
 "Farmer Engagement/Farmer Interview/Farmer Expo/20260516_HP_Photo_花博農民市集_Group.jpg": "farm-expo-group",
 "Farmer Engagement/Farmer Interview/Farmer Expo/IMG_0015.jpg": "farm-expo-1",
 "Farmer Engagement/Farmer Interview/Farmer Expo/IMG_0413.jpg": "farm-expo-2",
 "Farmer Engagement/Farmer Interview/Farmer Expo/IMG_0336.jpg": "farm-expo-3",
 "Farmer Engagement/Farmer Interview/Farmer Expo/DSC_0100.JPG": "farm-expo-4",
 "Farmer Engagement/Farmer Interview/Tamsui Happy Farm/20260721_HP_Photo_Outreach_FarmerChenInFarmDoingFarmingWithStudentsCuttingLeavesHarvestingOkra.jpg": "farm-tamsui-okra",
 "Farmer Engagement/Farmer Interview/Tamsui Happy Farm/20260721_HP_Photo_Outreach_FarmerChenOnHerKneesWithStudentsLookingAtSoil.jpg": "farm-tamsui-soil",
 "Farmer Engagement/Farmer Interview/Tamsui Happy Farm/20260721_HP_Photo_Outreach_StudentWatchingFarmerChenCook_GreatPhoto.jpg": "farm-tamsui-cook",
 "Farmer Engagement/Farmer Interview/Tamsui Happy Farm/20260721_HP_Photo_Outreach_GroupPhotoWithTeacherAndFarmerChen.jpg": "farm-tamsui-group",
 "Farmer Engagement/Farmer Interview/Tamsui Happy Farm/DSC02847.JPG": "farm-tamsui-1",
 "Farmer Engagement/Farmer Interview/Tamsui Happy Farm/DSC02566.JPG": "farm-tamsui-2",
 "Farmer Engagement/Farmer Interview/Water Garden Organic Farmers_ Market/DSC00303.JPG": "farm-market-1",
 "Farmer Engagement/Farmer Interview/Water Garden Organic Farmers_ Market/DSC00286.JPG": "farm-market-2",
 "Farmer Engagement/Farmer Interview/Water Garden Organic Farmers_ Market/BD10AB6A-A7A8-4C5E-9E9A-7D410F436592.jpg": "farm-market-3",
 "Farmer Engagement/Farmer Interview/Water Garden Organic Farmers_ Market/A32DB6AE-6F68-43E7-AB66-A4F0CFF21591.jpg": "farm-market-4",
 # LINE platform
 "Farmer Engagement/LINE platform/Fig 1._": "line-menu",
 "Farmer Engagement/LINE platform/Screenshot 2026-09-12 at 3.48.40\u202fPM.png": "line-1",
 "Farmer Engagement/LINE platform/Screenshot 2026-09-12 at 3.49.43\u202fPM.png": "line-2",
 "Farmer Engagement/LINE platform/Screenshot 2026-09-12 at 3.50.08\u202fPM.png": "line-3",
 "Farmer Engagement/LINE platform/Screenshot 2026-09-12 at 3.50.51\u202fPM.png": "line-4",
 "Farmer Engagement/LINE platform/Screenshot 2026-09-12 at 3.51.30\u202fPM.png": "line-5",
 "Farmer Engagement/LINE platform/截圖 2026-09-13 凌晨12.53.17.png": "line-6",
 # forum
 **{f"Public Engagement/Public Forum/{n}": f"forum-{n.split('.')[0].lower()}" for n in
    ["DSC08760.JPG","DSC09125.JPG","DSC08502.JPG","DSC-57.jpg","DSC08882.JPG","DSC08326.JPG","DSC08898.JPG","DSC-75.jpg","DSC09107.JPG","DSC08227.JPG"]},
 # booth
 "Public Engagement/Booth/Arts and Crafts.jpg": "booth-crafts",
 "Public Engagement/Booth/Arts and Crafts(1).jpg": "booth-crafts-b",
 "Public Engagement/Booth/Releaf_ Project Introduction.jpg": "booth-intro",
 "Public Engagement/Booth/Releaf_ Project introduction(1).jpg": "booth-intro-b",
 "Public Engagement/Booth/ReLeaf- Project Introduction.jpg": "booth-intro-c",
 "Public Engagement/Booth/IMG_0749.jpg": "booth-misc-1",
 "Public Engagement/Booth/IMG_4817.jpg": "booth-misc-2",
 "Public Engagement/Booth/Data physicalization.jpg": "booth-dataphys",
 "Public Engagement/Booth/Data physicalization(1).jpg": "booth-dataphys-b",
 "Public Engagement/Booth/Data physicalization(2).jpg": "booth-dataphys-c",
 "Public Engagement/Booth/Data physicalization(3).jpg": "booth-dataphys-d",
 "Public Engagement/Booth/Ring Toss.jpg": "booth-ringtoss",
 "Public Engagement/Booth/Ring Toss(1).jpg": "booth-ringtoss-b",
 "Public Engagement/Booth/Coffee Infographic.jpg": "booth-coffee",
 "Public Engagement/Booth/Online Game.jpg": "booth-game",
}
G = SRC / "Graphs/Public Engagement"
GR = {
 "Fig 1_ Identification of Highest Plant Stress Region (Total responses_ 62).png": "kap-fig1",
 " Fig 2 _  Level of Understanding of Various Booth Related Topics (Total responses_ 62).png": "kap-fig2",
 " Fig 3_ Changes in Visitor Attitude & Perception (Total Responses_ 62).png": "kap-fig3",
}
def run(src, slug, width):
    tmp = OUT / f"{slug}.tmp.png"
    subprocess.run(["magick", str(src), "-auto-orient", "-resize", f"{width}x{width}>", "-strip", str(tmp)], check=True)
    subprocess.run(["cwebp", "-quiet", "-q", "80", str(tmp), "-o", str(OUT / f"{slug}.webp")], check=True)
    tmp.unlink()
for rel, slug in M.items():
    s = P / rel
    if not s.exists(): print("MISSING", rel, file=sys.stderr); continue
    if not (OUT / f"{slug}.webp").exists(): run(s, slug, 1600)
for rel, slug in GR.items():
    s = G / rel
    if not s.exists(): print("MISSING", rel, file=sys.stderr); continue
    if not (OUT / f"{slug}.webp").exists(): run(s, slug, 2000)
print("done")

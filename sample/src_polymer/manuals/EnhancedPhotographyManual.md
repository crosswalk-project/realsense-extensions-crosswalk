## Concept
This is a series of demos to demonstrate the ability of manipulating the depth enhanced photo. You will find all the related demos are in the sub-menu of the "Depth Enhanced Photography" entry.

## Capture a Depth Photo
Before you can try any of the photo enhanced feature, the first thing you need to do is to shot a photo with the depth information. Make sure the RealSense camera is well connected and enabled, choose a suitable resolution and take a photo. It will be saved in the `Pictures` directory for the current user with a predefined name `depthphoto_<timestamp>.jpg`. You will need to load this photo to proceed the following sections.

## Query Information of Depth Photo
By loading the saved photo from the `Capture a Depth Photo` section, you can easily query the meta-data of the depth photo using `Photo` demo. Besides you can also query the **container image**, **depth image** and **raw depth image** within the depth photo.

## Depth Photo Manipulation
There are more functionalities have been provided to the depth photo manipulation, which normal photo without depth information cannot imagine. Navigate to `Enhanced Photo` demo, load the saved depth photo and have a try. Those functionalities includes:

### Measurement
You can easily measure the distance between any two points in this depth photo, by simply drag a line between the start and end point. Then the distance result will appear within the middle of line.

### Refocus
Your photo is not correctly focused? never mind, try the magic `Refocus`. Simply click the point that you want to focus within the photo, and then you can see the focus change to it and the photo get refocused.

### Paste on Plane
You can also paste any sticker onto the plane area of your photo. First load the sticker photo into the demo, then drag a baseline on the plane area of the
photo, then you will see the sticker image is pasted onto the plane area along the baseline you've just drawn.

### Color Pop
In this showcase, by clicking a specific point within the photo, a color region around the specified point will be selected while suppressing color of the rest pixels of the image. The region is assigned based on pixel depth values.

## Photo Utilities
There is a photo utility API has been provided to the developer, and the demo `Photo Utilities` is trying to demonstrate the capabilities of this helper tool. You can resize the color image, resize the depth image, query and enhance the depth image's quality, crop the photo by selected region, and rotate the photo.

## Advanced Depth Photo Manipulation
There are also two sophisticated demos to demonstrate the advanced feature of depth photo manipulation. Which includes:

### Segmentation
The sample converts any preview image to a photo image and then segment the image given the specified region of interest. You can edit the resulting segmentation mask by manually marking the foreground pixels.

Load the depth photo, then you can draw on the display panel to specify the region of interest for segmentation. it will start auto segmentation when you complete the region of interest selection (as a red rectangle.) It shows the foreground pixels with the original color and the background pixels gray.

You can further refine the segmentation mask by manually drawing the blue lines that indicate where the foreground pixels should be. With each manual correction, the sample re-generates the segmentation mask and shows the masked image in the display panel.

Toggle on the `Foreground` button to refine the foreground pixel, instead toggle it off to refine the background pixel.

### Motion Effect
This demo converts any preview image to a photo image and then shows the different motion effects such as rotation and zooming.

Load your photo, and try to adjust the attribute sliders on the right panel to see the motion effect.